import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { acceptInvitationForViewer } from "@/server/facades/workspace-facade";
import { WorkspaceTeamError } from "@/server/application/workspace/workspace-team-service";

export const runtime = "nodejs";

const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = acceptInvitationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid invitation payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const accepted = await acceptInvitationForViewer(viewer, parsed.data.token);
    return NextResponse.json({ accepted }, { status: 200 });
  } catch (error) {
    if (error instanceof WorkspaceTeamError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/workspace/invitations/accept",
        request,
        message: "Workspace invitation acceptance failed with a handled domain error",
        error,
        status: error.status,
        metadata: {
          userId: viewer.userId,
          workspaceId: viewer.workspaceId ?? null,
        },
      });

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logRouteError({
      route: "/api/workspace/invitations/accept",
      request,
      message: "Workspace invitation acceptance failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        workspaceId: viewer.workspaceId ?? null,
      },
    });

    return NextResponse.json(
      { error: "Unable to accept invitation" },
      { status: 500 },
    );
  }
}
