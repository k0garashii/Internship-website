import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError } from "@/lib/config/user-config";
import { logRouteError, logRouteEvent } from "@/lib/observability/error-logging";
import {
  SearchPersistenceError,
} from "@/lib/search/persistence";
import { SearchDiscoveryError } from "@/lib/search/discovery";
import { buildSignalsFromQueryExecutions, recordSearchBehaviorEvent } from "@/server/application/personalization/search-behavior-service";
import { runSearchDiscovery } from "@/server/facades/search-facade";

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

    const result = await runSearchDiscovery(viewer);

    await recordSearchBehaviorEvent(viewer, {
      type: "SEARCH_EXECUTED",
      searchRunId: result.persistence.searchRunId,
      queryText: result.queryExecutions.map((execution) => execution.queryText).join(" | "),
      signals: buildSignalsFromQueryExecutions(result.queryExecutions),
      metadata: {
        offerCount: result.offerCount,
        executedQueryCount: result.executedQueryCount,
      },
    });

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
        persistedOfferCount: result.persistence.persistedOfferCount,
        searchRunId: result.persistence.searchRunId,
      },
    });

    return NextResponse.json(result, {
      status: 200,
    });
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
