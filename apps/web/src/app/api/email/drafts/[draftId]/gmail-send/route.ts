import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  EmailDraftDeliveryError,
  sendEmailDraftWithGmail,
} from "@/lib/email/drafts";
import { logRouteError } from "@/lib/observability/error-logging";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  },
) {
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

  const { draftId } = await context.params;

  let payload: unknown = {};

  try {
    if (request.headers.get("content-length") !== "0") {
      payload = await request.json();
    }
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/email/drafts/[draftId]/gmail-send",
      request,
      message: "Invalid JSON payload received during Gmail send",
      error,
      status: 400,
      metadata: {
        userId: viewer.userId,
        draftId,
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
    const draft = await sendEmailDraftWithGmail(viewer.userId, draftId, payload);

    return NextResponse.json(draft, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof EmailDraftDeliveryError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/email/drafts/[draftId]/gmail-send",
        request,
        message: "Handled Gmail send failure",
        error,
        status: error.status,
        metadata: {
          userId: viewer.userId,
          draftId,
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
      route: "/api/email/drafts/[draftId]/gmail-send",
      request,
      message: "Unexpected Gmail send failure",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        draftId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to send Gmail message",
      },
      {
        status: 500,
      },
    );
  }
}
