import {
  BillingProvider,
  type Prisma,
  SubscriptionStatus,
} from "@prisma/client";

import {
  getDefaultPlanDefinition,
  PLAN_CATALOG,
} from "@/server/domain/billing/plan-catalog";
import { db } from "@/server/infrastructure/prisma/client";

type TxClient = Prisma.TransactionClient;

async function upsertPlanCatalogEntry(tx: TxClient, plan: (typeof PLAN_CATALOG)[number]) {
  return tx.plan.upsert({
    where: {
      code: plan.code,
    },
    update: {
      name: plan.name,
      provider: plan.provider,
      billingInterval: plan.billingInterval,
      priceCents: plan.priceCents,
      currency: plan.currency,
      isDefault: plan.isDefault,
      featureMatrix: plan.featureMatrix,
      isArchived: false,
    },
    create: {
      code: plan.code,
      name: plan.name,
      provider: plan.provider,
      billingInterval: plan.billingInterval,
      priceCents: plan.priceCents,
      currency: plan.currency,
      isDefault: plan.isDefault,
      featureMatrix: plan.featureMatrix,
    },
  });
}

export async function seedPlanCatalogTx(tx: TxClient) {
  const plans = [];

  for (const entry of PLAN_CATALOG) {
    plans.push(await upsertPlanCatalogEntry(tx, entry));
  }

  return plans;
}

export async function ensureWorkspaceBillingBootstrapTx(
  tx: TxClient,
  workspaceId: string,
) {
  const plans = await seedPlanCatalogTx(tx);
  const defaultPlan = plans.find((plan) => plan.code === getDefaultPlanDefinition().code);

  if (!defaultPlan) {
    throw new Error("Default plan catalog entry is missing");
  }

  const existingSubscription = await tx.workspaceSubscription.findFirst({
    where: {
      workspaceId,
      status: {
        in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE],
      },
    },
    select: {
      id: true,
    },
  });

  if (!existingSubscription) {
    await tx.workspaceSubscription.create({
      data: {
        workspaceId,
        planId: defaultPlan.id,
        provider: BillingProvider.INTERNAL,
        status: SubscriptionStatus.ACTIVE,
        seats: 1,
        currentPeriodStart: new Date(),
      },
    });
  }

  return defaultPlan;
}

export async function recordBillingEventTx(
  tx: TxClient,
  input: {
    workspaceId: string;
    actorUserId?: string | null;
    subscriptionId?: string | null;
    provider?: BillingProvider;
    eventType: string;
    payload?: Prisma.InputJsonValue | null;
  },
) {
  return tx.billingEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      provider: input.provider ?? BillingProvider.INTERNAL,
      eventType: input.eventType,
      payload: input.payload ?? undefined,
    },
  });
}

export async function getWorkspaceBillingSummary(workspaceId: string) {
  const subscription = await db.workspaceSubscription.findFirst({
    where: {
      workspaceId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      plan: true,
    },
  });

  return {
    workspaceId,
    subscriptionId: subscription?.id ?? null,
    status: subscription?.status ?? null,
    planCode: subscription?.plan.code ?? null,
    planName: subscription?.plan.name ?? null,
  };
}
