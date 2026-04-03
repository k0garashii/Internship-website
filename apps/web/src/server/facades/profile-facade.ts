import { AppJobType } from "@prisma/client";

import type { AuthenticatedViewer } from "@/lib/auth/viewer";
import { assertWorkspaceViewer } from "@/lib/auth/viewer";
import { enqueueAppJob } from "@/server/application/jobs/job-queue-service";

export async function enqueueProfileEnrichmentRefresh(viewer: AuthenticatedViewer) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  return enqueueAppJob({
    type: AppJobType.PROFILE_ENRICHMENT_REFRESH,
    userId: workspaceViewer.userId,
    workspaceId: workspaceViewer.workspaceId,
    payload: {
      userId: workspaceViewer.userId,
      workspaceId: workspaceViewer.workspaceId,
    },
  });
}
