import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { getWorkspaceControlCenter } from "@/server/facades/workspace-facade";

export const runtime = "nodejs";

export async function GET() {
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

  try {
    const snapshot = await getWorkspaceControlCenter(viewer);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    logRouteError({
      route: "/api/workspace",
      message: "Workspace control center failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        workspaceId: viewer.workspaceId ?? null,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to load workspace information",
      },
      {
        status: 500,
      },
    );
  }
}
