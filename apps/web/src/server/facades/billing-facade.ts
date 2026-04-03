import { getWorkspaceBillingSummary } from "@/server/application/billing/billing-service";
import { resolveWorkspaceEntitlements } from "@/server/application/entitlements/entitlement-service";

export async function getWorkspaceCommercialSnapshot(workspaceId: string) {
  const [billing, entitlements] = await Promise.all([
    getWorkspaceBillingSummary(workspaceId),
    resolveWorkspaceEntitlements(workspaceId),
  ]);

  return {
    billing,
    entitlements,
  };
}
