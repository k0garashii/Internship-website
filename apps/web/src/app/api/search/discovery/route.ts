import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logRouteError, logRouteEvent } from "@/lib/observability/error-logging";
import {
  SearchDiscoveryError,
  discoverInitialOffers,
} from "@/lib/search/discovery";
import {
  SearchPersistenceError,
  persistSearchDiscoveryResult,
} from "@/lib/search/persistence";

export const runtime = "nodejs";

async function handleSearchDiscovery(request: Request) {
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
    logRouteEvent({
      route: "/api/search/discovery",
      request,
      message: "Search discovery started",
      status: 202,
      metadata: {
        userId: viewer.userId,
      },
    });

    const config = await exportUserConfig(viewer);
    const result = await discoverInitialOffers(config);
    const persistence = await persistSearchDiscoveryResult(viewer.userId, result);

    logRouteEvent({
      route: "/api/search/discovery",
      request,
      message: "Search discovery completed",
      status: 200,
      metadata: {
        userId: viewer.userId,
        offerCount: result.offerCount,
        normalizedOfferCount: result.normalizedOffers.length,
        executedQueryCount: result.executedQueryCount,
        persistedOfferCount: persistence.persistedOfferCount,
        searchRunId: persistence.searchRunId,
      },
    });

    return NextResponse.json(
      {
        ...result,
        persistence,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (
      error instanceof UserConfigError ||
      error instanceof SearchDiscoveryError ||
      error instanceof SearchPersistenceError
    ) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/search/discovery",
        message: "Search discovery failed with a handled domain error",
        error,
        status: error.status,
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
      route: "/api/search/discovery",
      message: "Search discovery failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to search offers",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(request: Request) {
  return handleSearchDiscovery(request);
}

export async function POST(request: Request) {
  return handleSearchDiscovery(request);
}
