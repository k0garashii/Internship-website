import { assertAuthenticatedViewer, assertWorkspaceViewer, type AuthenticatedViewer } from "@/lib/auth/viewer";

type UserScopedWhere = Record<string, unknown> & {
  userId?: string;
};

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function userScope(viewer: AuthenticatedViewer): { userId: string } {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);

  return { userId: authenticatedViewer.userId };
}

export function workspaceScope(
  viewer: AuthenticatedViewer,
): { userId: string; workspaceId: string } {
  const workspaceViewer = assertWorkspaceViewer(viewer);

  return {
    userId: workspaceViewer.userId,
    workspaceId: workspaceViewer.workspaceId,
  };
}

export function requireViewerWorkspaceId(viewer: AuthenticatedViewer): string {
  return assertWorkspaceViewer(viewer).workspaceId;
}

export function scopedWhere<TWhere extends UserScopedWhere>(
  viewer: AuthenticatedViewer,
  where?: TWhere,
): TWhere & { userId: string } {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);

  if (where?.userId && where.userId !== authenticatedViewer.userId) {
    throw new AuthorizationError("Cross-user access denied");
  }

  return {
    ...(where ?? ({} as TWhere)),
    userId: authenticatedViewer.userId,
  };
}

export function scopedById(
  viewer: AuthenticatedViewer,
  id: string,
): { id: string; userId: string } {
  return {
    id,
    ...userScope(viewer),
  };
}

export function assertOwnedByViewer(
  viewer: AuthenticatedViewer,
  ownerUserId: string | null | undefined,
  resourceName = "resource",
): void {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);

  if (!ownerUserId || ownerUserId !== authenticatedViewer.userId) {
    throw new AuthorizationError(`${resourceName} is not accessible`);
  }
}
