import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { OfferFeedbackError, saveOfferFeedback } from "@/lib/search/feedback";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      offerId: string;
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

  const { offerId } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/search/offers/[offerId]/feedback",
      request,
      message: "Invalid JSON payload received during feedback save",
      error,
      status: 400,
      metadata: {
        userId: viewer.userId,
        offerId,
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
    const feedback = await saveOfferFeedback(viewer.userId, offerId, payload);

    return NextResponse.json(feedback, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof OfferFeedbackError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/search/offers/[offerId]/feedback",
        request,
        message: "Feedback save failed with a handled domain error",
        error,
        status: error.status,
        metadata: {
          userId: viewer.userId,
          offerId,
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
      route: "/api/search/offers/[offerId]/feedback",
      request,
      message: "Feedback save failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        offerId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to save feedback",
      },
      {
        status: 500,
      },
    );
  }
}
