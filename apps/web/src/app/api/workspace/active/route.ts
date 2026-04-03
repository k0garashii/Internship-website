import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { switchWorkspace } from "@/server/facades/workspace-facade";

export const runtime = "nodejs";

const switchWorkspaceSchema = z.object({
  workspaceId: z.string().trim().min(1),
});

export async function PATCH(request: Request) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json(
      {
        error: "Authentication required",
      },
      {
        status: 401,
      },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/workspace/active",
      request,
      message: "Invalid JSON payload received during workspace switch",
      error,
      status: 400,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Invalid JSON payload",
      },
      {
        status: 400,
      },
    );
  }

  const parsed = switchWorkspaceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid workspace switch payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const switched = await switchWorkspace(viewer, parsed.data.workspaceId);

    if (!switched) {
      return NextResponse.json(
        {
          error: "Workspace is not accessible",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        switched,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    logRouteError({
      route: "/api/workspace/active",
      request,
      message: "Workspace switch failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        workspaceId: viewer.workspaceId ?? null,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to switch workspace",
      },
      {
        status: 500,
      },
    );
  }
}
