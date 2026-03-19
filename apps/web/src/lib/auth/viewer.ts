export type AuthenticatedViewer = {
  userId: string;
  sessionId?: string;
  email?: string;
  fullName?: string;
};

export function assertAuthenticatedViewer(
  viewer: AuthenticatedViewer | null | undefined,
): AuthenticatedViewer {
  if (!viewer?.userId) {
    throw new Error("Authentication required");
  }

  return viewer;
}
