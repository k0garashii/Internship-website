import { BillingProvider, SubscriptionStatus, WorkspaceMemberRole } from "@prisma/client";

import type { AuthenticatedViewer } from "@/lib/auth/viewer";
import { assertWorkspaceViewer } from "@/lib/auth/viewer";
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  getStripeConfig,
  readSubscriptionPeriodEnd,
  readSubscriptionPeriodStart,
  retrieveStripeSubscription,
  type StripeConfig,
  type StripeEvent,
  type StripeSubscription,
} from "@/lib/billing/stripe";
import { logServiceEvent } from "@/lib/observability/error-logging";
import { recordBillingEventTx, seedPlanCatalogTx } from "@/server/application/billing/billing-service";
import { db } from "@/server/infrastructure/prisma/client";

const BILLING_MANAGER_ROLES: WorkspaceMemberRole[] = [
  WorkspaceMemberRole.OWNER,
  WorkspaceMemberRole.ADMIN,
];
const PAID_ACCESS_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
];

export class BillingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export function mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    default:
      // incomplete, incomplete_expired, paused: no access until paid.
      return SubscriptionStatus.EXPIRED;
  }
}

function requireStripeConfig() {
  const config = getStripeConfig();

  if (!config) {
    throw new BillingError("Le paiement en ligne n’est pas encore configuré.", 503);
  }

  return config;
}

function assertBillingManager(viewer: AuthenticatedViewer) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  if (!workspaceViewer.workspaceRole || !BILLING_MANAGER_ROLES.includes(workspaceViewer.workspaceRole)) {
    throw new BillingError("Seuls le propriétaire et les administrateurs gèrent l’abonnement.", 403);
  }

  return workspaceViewer;
}

export async function startProCheckout(viewer: AuthenticatedViewer, appBaseUrl: string) {
  const config = requireStripeConfig();
  const workspaceViewer = assertBillingManager(viewer);
  const [workspace, activePaidSubscription] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceViewer.workspaceId },
      select: { stripeCustomerId: true },
    }),
    db.workspaceSubscription.findFirst({
      where: {
        workspaceId: workspaceViewer.workspaceId,
        provider: BillingProvider.STRIPE,
        status: { in: PAID_ACCESS_STATUSES },
      },
      select: { id: true },
    }),
  ]);

  if (activePaidSubscription) {
    throw new BillingError("Ce workspace a déjà un abonnement Pro actif.", 409);
  }

  const session = await createStripeCheckoutSession(config, {
    workspaceId: workspaceViewer.workspaceId,
    customerId: workspace?.stripeCustomerId ?? null,
    customerEmail: workspaceViewer.email ?? "",
    successUrl: `${appBaseUrl}/workspace/billing?checkout=success`,
    cancelUrl: `${appBaseUrl}/workspace/billing?checkout=canceled`,
  });

  return { url: session.url };
}

export async function openBillingPortal(viewer: AuthenticatedViewer, appBaseUrl: string) {
  const config = requireStripeConfig();
  const workspaceViewer = assertBillingManager(viewer);
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceViewer.workspaceId },
    select: { stripeCustomerId: true },
  });

  if (!workspace?.stripeCustomerId) {
    throw new BillingError("Aucun abonnement Stripe n’est rattaché à ce workspace.", 404);
  }

  const session = await createStripePortalSession(config, {
    customerId: workspace.stripeCustomerId,
    returnUrl: `${appBaseUrl}/workspace/billing`,
  });

  return { url: session.url };
}

async function resolveWorkspaceIdForSubscription(subscription: StripeSubscription, hint: string | null) {
  if (hint) {
    return hint;
  }

  if (subscription.metadata?.workspaceId) {
    return subscription.metadata.workspaceId;
  }

  const workspace = await db.workspace.findUnique({
    where: { stripeCustomerId: subscription.customer },
    select: { id: true },
  });

  return workspace?.id ?? null;
}

export async function syncStripeSubscription(
  subscription: StripeSubscription,
  workspaceIdHint: string | null,
  eventId: string | null,
) {
  const workspaceId = await resolveWorkspaceIdForSubscription(subscription, workspaceIdHint);

  if (!workspaceId) {
    throw new BillingError(`No workspace found for Stripe subscription ${subscription.id}`, 404);
  }

  const status = mapStripeSubscriptionStatus(subscription.status);

  await db.$transaction(async (tx) => {
    const plans = await seedPlanCatalogTx(tx);
    const proPlan = plans.find((plan) => plan.code === "PRO");

    if (!proPlan) {
      throw new Error("PRO plan is missing from the catalog");
    }

    await tx.workspace.update({
      where: { id: workspaceId },
      data: { stripeCustomerId: subscription.customer },
    });

    const data = {
      workspaceId,
      planId: proPlan.id,
      provider: BillingProvider.STRIPE,
      status,
      currentPeriodStart: readSubscriptionPeriodStart(subscription),
      currentPeriodEnd: readSubscriptionPeriodEnd(subscription),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
    const saved = await tx.workspaceSubscription.upsert({
      where: { externalSubscriptionId: subscription.id },
      update: data,
      create: { ...data, externalSubscriptionId: subscription.id },
      select: { id: true },
    });

    await recordBillingEventTx(tx, {
      workspaceId,
      subscriptionId: saved.id,
      provider: BillingProvider.STRIPE,
      eventType: "stripe.subscription.synced",
      payload: { eventId, stripeSubscriptionId: subscription.id, stripeStatus: subscription.status },
    });
  });

  logServiceEvent({
    scope: "billing/stripe",
    message: "Stripe subscription synchronized",
    metadata: { workspaceId, subscriptionId: subscription.id, status },
  });
}

// Events are only used as triggers: the subscription is always re-read from
// Stripe, so retried or out-of-order deliveries cannot apply a stale state.
export async function handleStripeEvent(config: StripeConfig, event: StripeEvent) {
  const object = event.data.object;

  if (event.type === "checkout.session.completed") {
    const subscriptionId = typeof object.subscription === "string" ? object.subscription : null;
    const workspaceId =
      typeof object.client_reference_id === "string" ? object.client_reference_id : null;

    if (!subscriptionId) {
      return { handled: false };
    }

    await syncStripeSubscription(
      await retrieveStripeSubscription(config, subscriptionId),
      workspaceId,
      event.id,
    );
    return { handled: true };
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscriptionId = typeof object.id === "string" ? object.id : null;

    if (!subscriptionId) {
      return { handled: false };
    }

    await syncStripeSubscription(
      await retrieveStripeSubscription(config, subscriptionId),
      null,
      event.id,
    );
    return { handled: true };
  }

  return { handled: false };
}
