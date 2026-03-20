import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logRouteError } from "@/lib/observability/error-logging";

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

    return NextResponse.json(config, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof UserConfigError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/config/export",
        message: "Configuration export failed with a handled domain error",
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
      route: "/api/config/export",
      message: "Configuration export failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to export configuration",
      },
      {
        status: 500,
      },
    );
  }
}
