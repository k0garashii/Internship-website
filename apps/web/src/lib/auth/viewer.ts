import type { WorkspaceMemberRole } from "@prisma/client";

export type AuthenticatedViewer = {
  userId: string;
  sessionId?: string;
  email?: string;
  fullName?: string;
  workspaceId?: string;
  workspaceSlug?: string;
  workspaceName?: string;
  workspaceRole?: WorkspaceMemberRole;
};

export function assertAuthenticatedViewer(
  viewer: AuthenticatedViewer | null | undefined,
): AuthenticatedViewer {
  if (!viewer?.userId) {
    throw new Error("Authentication required");
  }

  return viewer;
}

export function assertWorkspaceViewer(
  viewer: AuthenticatedViewer | null | undefined,
): AuthenticatedViewer & { workspaceId: string } {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);

  if (!authenticatedViewer.workspaceId) {
    throw new Error("Workspace context required");
  }

  return authenticatedViewer as AuthenticatedViewer & { workspaceId: string };
}
