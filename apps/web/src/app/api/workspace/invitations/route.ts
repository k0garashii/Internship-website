import { NextResponse } from "next/server";
import { WorkspaceMemberRole } from "@prisma/client";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { getWorkspaceControlCenter, inviteWorkspaceMember } from "@/server/facades/workspace-facade";
import { WorkspaceTeamError } from "@/server/application/workspace/workspace-team-service";

export const runtime = "nodejs";

const invitationSchema = z.object({
  email: z.string().trim().email(),
  role: z.nativeEnum(WorkspaceMemberRole),
});

export async function GET() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const snapshot = await getWorkspaceControlCenter(viewer);
    return NextResponse.json({ invitations: snapshot.invitations }, { status: 200 });
  } catch (error) {
    logRouteError({
      route: "/api/workspace/invitations",
      message: "Workspace invitation listing failed",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        workspaceId: viewer.workspaceId ?? null,
      },
    });

    return NextResponse.json(
      { error: "Unable to list invitations" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const parsed = invitationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid workspace invitation payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const invitation = await inviteWorkspaceMember(viewer, parsed.data);
    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceTeamError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/workspace/invitations",
        request,
        message: "Workspace invitation creation failed with a handled domain error",
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
      route: "/api/workspace/invitations",
      request,
      message: "Workspace invitation creation failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        workspaceId: viewer.workspaceId ?? null,
      },
    });

    return NextResponse.json(
      { error: "Unable to create invitation" },
      { status: 500 },
    );
  }
}
