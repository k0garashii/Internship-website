import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { listEmailDraftsForUser } from "@/lib/email/drafts";
import { logRouteError } from "@/lib/observability/error-logging";

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
    const drafts = await listEmailDraftsForUser(viewer.userId);

    return NextResponse.json(
      {
        draftCount: drafts.length,
        drafts,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    logRouteError({
      route: "/api/email/drafts",
      message: "Draft listing failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to list drafts",
      },
      {
        status: 500,
      },
    );
  }
}
