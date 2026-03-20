import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import {
  SearchOfferListingError,
  listPersistedOffersForUser,
} from "@/lib/search/listing";

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
    const result = await listPersistedOffersForUser(viewer.userId);

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof SearchOfferListingError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/search/offers",
        message: "Offer listing failed with a handled domain error",
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
      route: "/api/search/offers",
      message: "Offer listing failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to list offers",
      },
      {
        status: 500,
      },
    );
  }
}
