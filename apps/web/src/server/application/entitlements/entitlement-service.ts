import { EntitlementSource, WorkspaceFeature, type WorkspaceMemberRole } from "@prisma/client";

import { getFeatureAccessErrorMessage } from "@/server/domain/authz/permissions";
import {
  getDefaultPlanDefinition,
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

export async function resolveWorkspaceEntitlements(workspaceId: string) {
  const [subscription, overrides] = await Promise.all([
    db.workspaceSubscription.findFirst({
      where: {
        workspaceId,
        status: {
          in: ["TRIALING", "ACTIVE"],
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
  ]);

  const planMatrix = normalizePlanFeatureMatrix(subscription?.plan.featureMatrix);
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
    planCode: subscription?.plan.code ?? getDefaultPlanDefinition().code,
    planName: subscription?.plan.name ?? getDefaultPlanDefinition().name,
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
