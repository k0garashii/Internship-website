import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { disconnectGmailConnection } from "@/lib/email/gmail-connection";
import { logRouteError } from "@/lib/observability/error-logging";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    const snapshot = await disconnectGmailConnection(viewer.userId);

    return NextResponse.json(snapshot, {
      status: 200,
    });
  } catch (error) {
    logRouteError({
      route: "/api/email/google/disconnect",
      request,
      message: "Gmail disconnect failed",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to disconnect Gmail",
      },
      {
        status: 500,
      },
    );
  }
}
