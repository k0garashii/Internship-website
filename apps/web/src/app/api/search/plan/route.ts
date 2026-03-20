import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logRouteError } from "@/lib/observability/error-logging";
import { buildSearchQueryPlan } from "@/lib/search/query-plan";

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
