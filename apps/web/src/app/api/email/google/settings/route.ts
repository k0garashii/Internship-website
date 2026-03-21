import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { GmailMailboxError, updateGmailSyncSettings } from "@/lib/email/gmail-connection";
import { logRouteError } from "@/lib/observability/error-logging";

const updateSettingsSchema = z.object({
  syncQuery: z.string().trim().max(240).nullable().optional(),
});

export const runtime = "nodejs";

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
      route: "/api/email/google/settings",
      request,
      message: "Invalid JSON payload received during Gmail settings update",
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

  const parsed = updateSettingsSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid Gmail settings payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const snapshot = await updateGmailSyncSettings(viewer.userId, parsed.data);

    return NextResponse.json(snapshot, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof GmailMailboxError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/email/google/settings",
        request,
        message: "Handled Gmail settings update failure",
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
      route: "/api/email/google/settings",
      request,
      message: "Unexpected Gmail settings update failure",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to update Gmail settings",
      },
      {
        status: 500,
      },
    );
  }
}
