import { randomUUID } from "node:crypto";

import type { WorkspaceFeature } from "@prisma/client";

import { getWorkspaceFeatureAccess } from "@/server/application/entitlements/entitlement-service";
import { db } from "@/server/infrastructure/prisma/client";

export type FeatureQuotaResult = {
  allowed: boolean;
  used: number;
  limit: number | null;
};

export function startOfUsagePeriod(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getFeatureUsage(workspaceId: string, feature: WorkspaceFeature, now = new Date()) {
  const usage = await db.featureUsage.findUnique({
    where: {
      workspaceId_feature_periodStart: {
        workspaceId,
        feature,
        periodStart: startOfUsagePeriod(now),
      },
    },
    select: { count: true },
  });

  return usage?.count ?? 0;
}

// Counts one use of a monthly-limited feature. The increment and the limit
// check happen in one statement, so concurrent calls cannot exceed the quota.
export async function consumeFeatureQuota(
  workspaceId: string,
  feature: WorkspaceFeature,
  now = new Date(),
): Promise<FeatureQuotaResult> {
  const access = await getWorkspaceFeatureAccess(workspaceId, feature);
  const limit = access.limitValue ?? null;

  if (!access.enabled || (limit !== null && limit <= 0)) {
    return { allowed: false, used: await getFeatureUsage(workspaceId, feature, now), limit: limit ?? 0 };
  }

  const periodStart = startOfUsagePeriod(now);
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "FeatureUsage" ("id", "workspaceId", "feature", "periodStart", "count", "updatedAt")
    VALUES (${randomUUID()}, ${workspaceId}, ${feature}::"WorkspaceFeature", ${periodStart}, 1, NOW())
    ON CONFLICT ("workspaceId", "feature", "periodStart") DO UPDATE
      SET "count" = "FeatureUsage"."count" + 1, "updatedAt" = NOW()
      WHERE ${limit}::int IS NULL OR "FeatureUsage"."count" < ${limit}::int
    RETURNING "count"
  `;

  if (rows.length === 0) {
    return { allowed: false, used: limit ?? 0, limit };
  }

  return { allowed: true, used: rows[0].count, limit };
}
