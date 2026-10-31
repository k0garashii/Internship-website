import {
  BillingProvider,
  EntitlementSource,
  SubscriptionStatus,
  WorkspaceFeature,
  WorkspaceMemberRole,
} from "@prisma/client";

import { isDeveloperEmail } from "@/lib/auth/developers";

import { getFeatureAccessErrorMessage } from "@/server/domain/authz/permissions";
import {
  getDefaultPlanDefinition,
  getPlanDefinition,
  normalizePlanFeatureMatrix,
  type PlanFeatureConfig,
} from "@/server/domain/billing/plan-catalog";
import { db } from "@/server/infrastructure/prisma/client";

type WorkspaceFeatureAccess = PlanFeatureConfig & {
  source: EntitlementSource | "PLAN";
};

export class FeatureAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly feature: WorkspaceFeature,
  ) {
    super(message);
    this.name = "FeatureAccessError";
  }
}

function buildDefaultAccessMap(): Record<WorkspaceFeature, WorkspaceFeatureAccess> {
  const matrix = getDefaultPlanDefinition().featureMatrix;
  const result = {} as Record<WorkspaceFeature, WorkspaceFeatureAccess>;

  for (const feature of Object.values(WorkspaceFeature)) {
    result[feature] = {
      enabled: matrix[feature].enabled,
      limitValue: matrix[feature].limitValue ?? null,
      source: "PLAN",
    };
  }

  return result;
}

// A paid subscription stays usable while Stripe retries a failed payment.
const ACCESS_GRANTING_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
];

export async function resolveWorkspaceEntitlements(workspaceId: string) {
  const [subscriptions, overrides, owners] = await Promise.all([
    db.workspaceSubscription.findMany({
      where: {
        workspaceId,
        status: {
          in: ACCESS_GRANTING_STATUSES,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
            featureMatrix: true,
          },
        },
      },
    }),
    db.workspaceEntitlement.findMany({
      where: {
        workspaceId,
      },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId, role: WorkspaceMemberRole.OWNER },
      select: { user: { select: { email: true } } },
    }),
  ]);

  // The internal free subscription stays active underneath a paid one, so a
  // paid plan wins whenever one is current.
  const subscription =
    subscriptions.find((candidate) => candidate.provider !== BillingProvider.INTERNAL) ??
    subscriptions.find((candidate) => candidate.status !== SubscriptionStatus.PAST_DUE) ??
    null;
  const isDeveloperWorkspace = owners.some((owner) => isDeveloperEmail(owner.user.email));
  const proPlan = getPlanDefinition("PRO");
  // The catalog in code is the source of truth; the JSON copied on the plan
  // row is only a fallback for plans that no longer exist in the catalog.
  const plan =
    isDeveloperWorkspace && proPlan
      ? proPlan
      : (getPlanDefinition(subscription?.plan.code) ?? null);
  const planMatrix = plan
    ? plan.featureMatrix
    : normalizePlanFeatureMatrix(subscription?.plan.featureMatrix);
  const merged = buildDefaultAccessMap();

  for (const feature of Object.values(WorkspaceFeature)) {
    merged[feature] = {
      enabled: planMatrix[feature].enabled,
      limitValue: planMatrix[feature].limitValue ?? null,
      source: "PLAN",
    };
  }

  for (const override of overrides) {
    merged[override.feature] = {
      enabled: override.enabled,
      limitValue: override.limitValue,
      source: override.source,
    };
  }

  return {
    workspaceId,
    planCode: plan?.code ?? subscription?.plan.code ?? getDefaultPlanDefinition().code,
    planName: isDeveloperWorkspace
      ? "Pro (développeur)"
      : (plan?.name ?? subscription?.plan.name ?? getDefaultPlanDefinition().name),
    isDeveloperWorkspace,
    subscription: subscription
      ? {
          provider: subscription.provider,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    features: merged,
  };
}

export async function getWorkspaceFeatureAccess(
  workspaceId: string,
  feature: WorkspaceFeature,
) {
  const entitlementState = await resolveWorkspaceEntitlements(workspaceId);
  return entitlementState.features[feature];
}

export async function assertWorkspaceFeatureAccess(
  workspaceId: string,
  feature: WorkspaceFeature,
) {
  const access = await getWorkspaceFeatureAccess(workspaceId, feature);

  if (!access.enabled) {
    throw new FeatureAccessError(getFeatureAccessErrorMessage(feature), 403, feature);
  }

  return access;
}

export async function upsertWorkspaceEntitlementOverride(input: {
  workspaceId: string;
  feature: WorkspaceFeature;
  enabled: boolean;
  limitValue?: number | null;
  source?: EntitlementSource;
}) {
  return db.workspaceEntitlement.upsert({
    where: {
      workspaceId_feature: {
        workspaceId: input.workspaceId,
        feature: input.feature,
      },
    },
    update: {
      enabled: input.enabled,
      limitValue: input.limitValue ?? null,
      source: input.source ?? EntitlementSource.OVERRIDE,
    },
    create: {
      workspaceId: input.workspaceId,
      feature: input.feature,
      enabled: input.enabled,
      limitValue: input.limitValue ?? null,
      source: input.source ?? EntitlementSource.OVERRIDE,
    },
  });
}

export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<
  Array<{
    userId: string;
    role: WorkspaceMemberRole;
    isDefault: boolean;
  }>
> {
  return db.workspaceMember.findMany({
    where: {
      workspaceId,
    },
    select: {
      userId: true,
      role: true,
      isDefault: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}
