import { NextResponse } from "next/server";
import { WorkspaceMemberRole } from "@prisma/client";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { changeWorkspaceMemberRole } from "@/server/facades/workspace-facade";
import { WorkspaceTeamError } from "@/server/application/workspace/workspace-team-service";

export const runtime = "nodejs";

const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(WorkspaceMemberRole),
});

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      memberUserId: string;
    }>;
  },
) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { memberUserId } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateMemberRoleSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid member role payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const member = await changeWorkspaceMemberRole(viewer, memberUserId, parsed.data.role);
    return NextResponse.json({ member }, { status: 200 });
  } catch (error) {
    if (error instanceof WorkspaceTeamError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/workspace/members/[memberUserId]",
        request,
        message: "Workspace member role update failed with a handled domain error",
        error,
        status: error.status,
        metadata: {
          userId: viewer.userId,
          workspaceId: viewer.workspaceId ?? null,
          memberUserId,
        },
      });

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logRouteError({
      route: "/api/workspace/members/[memberUserId]",
      request,
      message: "Workspace member role update failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        workspaceId: viewer.workspaceId ?? null,
        memberUserId,
      },
    });

    return NextResponse.json(
      { error: "Unable to update member role" },
      { status: 500 },
    );
  }
}
