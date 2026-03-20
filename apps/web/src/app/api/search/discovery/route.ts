import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logRouteError } from "@/lib/observability/error-logging";
import {
  SearchDiscoveryError,
  discoverInitialOffers,
} from "@/lib/search/discovery";

export const runtime = "nodejs";

async function handleSearchDiscovery() {
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
    const result = await discoverInitialOffers(config);

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof UserConfigError || error instanceof SearchDiscoveryError) {
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

export async function GET() {
  return handleSearchDiscovery();
}

export async function POST() {
  return handleSearchDiscovery();
}
