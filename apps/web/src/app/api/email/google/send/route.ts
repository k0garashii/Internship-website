import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { listEmailDeliveryLogsForUser } from "@/lib/email/delivery-logs";
import { GmailSendError, sendAdhocGmailMessage } from "@/lib/email/gmail-send";
import { logRouteError, logRouteEvent } from "@/lib/observability/error-logging";

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

  let payload: unknown = null;

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/email/google/send",
      request,
      message: "Invalid JSON payload received during ad hoc Gmail send",
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

  try {
    const result = await sendAdhocGmailMessage(viewer.userId, payload);

    logRouteEvent({
      route: "/api/email/google/send",
      request,
      message: "Ad hoc Gmail message sent",
      status: 200,
      metadata: {
        userId: viewer.userId,
        recipientEmail: result.deliveryLog.recipientEmail,
      },
    });

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof GmailSendError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/email/google/send",
        request,
        message: "Handled ad hoc Gmail send failure",
        error,
        status: error.status,
        metadata: {
          userId: viewer.userId,
        },
      });

      return NextResponse.json(
        {
          error: error.message,
          logs: await listEmailDeliveryLogsForUser(viewer.userId),
        },
        {
          status: error.status,
        },
      );
    }

    logRouteError({
      route: "/api/email/google/send",
      request,
      message: "Unexpected ad hoc Gmail send failure",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to send Gmail message",
        logs: await listEmailDeliveryLogsForUser(viewer.userId),
      },
      {
        status: 500,
      },
    );
  }
}
