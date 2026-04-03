import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { cancelWorkspaceInvitation } from "@/server/facades/workspace-facade";
import { WorkspaceTeamError } from "@/server/application/workspace/workspace-team-service";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      invitationId: string;
    }>;
  },
) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { invitationId } = await context.params;

  try {
    await cancelWorkspaceInvitation(viewer, invitationId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof WorkspaceTeamError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/workspace/invitations/[invitationId]",
        request,
        message: "Workspace invitation revocation failed with a handled domain error",
        error,
        status: error.status,
        metadata: {
          userId: viewer.userId,
          workspaceId: viewer.workspaceId ?? null,
          invitationId,
        },
      });

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logRouteError({
      route: "/api/workspace/invitations/[invitationId]",
      request,
      message: "Workspace invitation revocation failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        workspaceId: viewer.workspaceId ?? null,
        invitationId,
      },
    });

    return NextResponse.json(
      { error: "Unable to revoke invitation" },
      { status: 500 },
    );
  }
}
