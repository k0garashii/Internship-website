import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import {
  SearchOfferListingError,
  getPersistedOfferDetailForUser,
} from "@/lib/search/listing";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    offerId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
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

  try {
    const result = await getPersistedOfferDetailForUser(viewer.userId, offerId);

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof SearchOfferListingError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/search/offers/[offerId]",
        request,
        message: "Offer detail failed with a handled domain error",
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
      route: "/api/search/offers/[offerId]",
      request,
      message: "Offer detail failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        offerId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to load offer detail",
      },
      {
        status: 500,
      },
    );
  }
}
