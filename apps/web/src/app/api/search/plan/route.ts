import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logRouteError } from "@/lib/observability/error-logging";
import { buildSearchQueryPlan } from "@/lib/search/query-plan";
import { buildSignalsFromSearchPlan, recordSearchBehaviorEvent } from "@/server/application/personalization/search-behavior-service";

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
    const config = await exportUserConfig(viewer);
    const plan = buildSearchQueryPlan(config.personalProfile, config.searchTargets);

    await recordSearchBehaviorEvent(viewer, {
      type: "SEARCH_PLAN_VIEWED",
      queryText: plan.queries.map((query) => query.queryText).join(" | "),
      signals: buildSignalsFromSearchPlan(plan),
      metadata: {
        queryCount: plan.queries.length,
      },
    });

    return NextResponse.json(plan, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof UserConfigError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/search/plan",
        message: "Search plan generation failed with a handled domain error",
        error,
        status: error.status,
      });

      return NextResponse.json(
        {
          error: error.message,
          fieldErrors: error.fieldErrors ?? {},
        },
        {
          status: error.status,
        },
      );
    }

    logRouteError({
      route: "/api/search/plan",
      message: "Search plan generation failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to build the search query plan",
      },
      {
        status: 500,
      },
    );
  }
}
