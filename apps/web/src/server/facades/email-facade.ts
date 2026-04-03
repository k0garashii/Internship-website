import { WorkspaceFeature } from "@prisma/client";

import type { AuthenticatedViewer } from "@/lib/auth/viewer";
import { assertWorkspaceViewer } from "@/lib/auth/viewer";
import { generateOfferEmailDraft } from "@/lib/email/drafts";
import { sendAdhocGmailMessage } from "@/lib/email/gmail-send";
import { syncGmailMailbox } from "@/lib/email/gmail-sync";
import { assertWorkspaceFeatureAccess } from "@/server/application/entitlements/entitlement-service";

export async function generateOfferDraftForViewer(
  viewer: AuthenticatedViewer,
  jobOfferId: string,
) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  await assertWorkspaceFeatureAccess(
    workspaceViewer.workspaceId,
    WorkspaceFeature.EMAIL_DRAFT_GENERATION,
  );

  return generateOfferEmailDraft(workspaceViewer.userId, jobOfferId);
}

export async function syncGmailMailboxForViewer(viewer: AuthenticatedViewer) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  await assertWorkspaceFeatureAccess(
    workspaceViewer.workspaceId,
    WorkspaceFeature.EMAIL_GMAIL_SYNC,
  );

  return syncGmailMailbox(workspaceViewer.userId);
}

export async function sendAdhocGmailMessageForViewer(
  viewer: AuthenticatedViewer,
  input: unknown,
) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  await assertWorkspaceFeatureAccess(
    workspaceViewer.workspaceId,
    WorkspaceFeature.EMAIL_GMAIL_SEND,
  );

  return sendAdhocGmailMessage(workspaceViewer.userId, input);
}
