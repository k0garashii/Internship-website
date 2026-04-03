import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { GmailMailboxError } from "@/lib/email/gmail-connection";
import { GoogleIntegrationError } from "@/lib/email/google";
import { logRouteError } from "@/lib/observability/error-logging";
import { FeatureAccessError } from "@/server/application/entitlements/entitlement-service";
import { syncGmailMailboxForViewer } from "@/server/facades/email-facade";

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
    const result = await syncGmailMailboxForViewer(viewer);

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (
      error instanceof GmailMailboxError ||
      error instanceof GoogleIntegrationError ||
      error instanceof FeatureAccessError
    ) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/email/google/sync",
        request,
        message: "Handled Gmail sync failure",
        error,
        status: error.status,
        metadata: {
          userId: viewer.userId,
        },
      });

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    logRouteError({
      route: "/api/email/google/sync",
      request,
      message: "Unexpected Gmail sync failure",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to synchronize Gmail",
      },
      {
        status: 500,
      },
    );
  }
}
