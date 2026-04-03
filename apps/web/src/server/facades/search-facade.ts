import { WorkspaceFeature } from "@prisma/client";

import type { AuthenticatedViewer } from "@/lib/auth/viewer";
import { assertWorkspaceViewer } from "@/lib/auth/viewer";
import { exportUserConfig } from "@/lib/config/user-config";
import { discoverInitialOffers } from "@/lib/search/discovery";
import { persistSearchDiscoveryResult } from "@/lib/search/persistence";
import { assertWorkspaceFeatureAccess } from "@/server/application/entitlements/entitlement-service";
import { getEffectiveInferredPreferences } from "@/server/application/personalization/profile-inference-service";

export async function runSearchDiscovery(viewer: AuthenticatedViewer) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  await assertWorkspaceFeatureAccess(
    workspaceViewer.workspaceId,
    WorkspaceFeature.SEARCH_DISCOVERY,
  );

  const config = await exportUserConfig(workspaceViewer);
  const inferredPreferences = await getEffectiveInferredPreferences(
    workspaceViewer.userId,
    workspaceViewer.workspaceId,
  );
  const result = await discoverInitialOffers({
    ...config,
    inferredPreferences,
  });
  const persistence = await persistSearchDiscoveryResult(workspaceViewer, result);

  return {
    ...result,
    persistence,
  };
}
