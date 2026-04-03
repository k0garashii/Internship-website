import { WorkspaceMemberRole } from "@prisma/client";

import type { AuthenticatedViewer } from "@/lib/auth/viewer";
import { assertAuthenticatedViewer, assertWorkspaceViewer } from "@/lib/auth/viewer";
import { getWorkspaceCommercialSnapshot } from "@/server/facades/billing-facade";
import { getWorkspaceProviderHealth } from "@/server/application/ops/provider-health-service";
import {
  listAccessibleWorkspacesForUser,
  listWorkspaceMembersDetailed,
  switchActiveWorkspaceForUser,
} from "@/server/application/workspace/workspace-directory-service";
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  getInvitationPreview,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole,
} from "@/server/application/workspace/workspace-team-service";

export async function getWorkspaceControlCenter(viewer: AuthenticatedViewer) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  const [invitations, accessibleWorkspaces, members, commercial, providerHealth] =
    await Promise.all([
      listWorkspaceInvitations(workspaceViewer.workspaceId),
      listAccessibleWorkspacesForUser(workspaceViewer.userId),
      listWorkspaceMembersDetailed(workspaceViewer.workspaceId),
      getWorkspaceCommercialSnapshot(workspaceViewer.workspaceId),
      getWorkspaceProviderHealth({
        userId: workspaceViewer.userId,
        workspaceId: workspaceViewer.workspaceId,
      }),
    ]);

  return {
    currentWorkspace: {
      workspaceId: workspaceViewer.workspaceId,
      slug: workspaceViewer.workspaceSlug ?? null,
      name: workspaceViewer.workspaceName ?? null,
      role: workspaceViewer.workspaceRole ?? null,
    },
    accessibleWorkspaces,
    members,
    invitations,
    commercial,
    providerHealth,
  };
}

export async function switchWorkspace(viewer: AuthenticatedViewer, workspaceId: string) {
  const authenticatedViewer = assertWorkspaceViewer(viewer);
  return switchActiveWorkspaceForUser(authenticatedViewer.userId, workspaceId);
}

export async function inviteWorkspaceMember(
  viewer: AuthenticatedViewer,
  input: {
    email: string;
    role: WorkspaceMemberRole;
  },
) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  return createWorkspaceInvitation({
    workspaceId: workspaceViewer.workspaceId,
    actorUserId: workspaceViewer.userId,
    actorRole: workspaceViewer.workspaceRole,
    email: input.email,
    role: input.role,
  });
}

export async function cancelWorkspaceInvitation(
  viewer: AuthenticatedViewer,
  invitationId: string,
) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  return revokeWorkspaceInvitation({
    workspaceId: workspaceViewer.workspaceId,
    actorRole: workspaceViewer.workspaceRole,
    invitationId,
  });
}

export async function changeWorkspaceMemberRole(
  viewer: AuthenticatedViewer,
  memberUserId: string,
  nextRole: WorkspaceMemberRole,
) {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  return updateWorkspaceMemberRole({
    workspaceId: workspaceViewer.workspaceId,
    actorUserId: workspaceViewer.userId,
    actorRole: workspaceViewer.workspaceRole,
    memberUserId,
    nextRole,
  });
}

export async function acceptInvitationForViewer(
  viewer: AuthenticatedViewer,
  token: string,
) {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);

  return acceptWorkspaceInvitation({
    token,
    userId: authenticatedViewer.userId,
    userEmail: authenticatedViewer.email ?? "",
  });
}

export async function getInvitationSnapshot(token: string) {
  return getInvitationPreview(token);
}
