import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, importUserConfig } from "@/lib/config/user-config";
import { logRouteError } from "@/lib/observability/error-logging";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/config/import",
      request,
      message: "Invalid JSON payload received during configuration import",
      error,
      status: 400,
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
    const result = await importUserConfig(viewer, payload);

    return NextResponse.json(
      {
        importedAt: result.importedAt,
        sections: result.sections,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof UserConfigError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/config/import",
        request,
        message: "Configuration import failed with a handled domain error",
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
      route: "/api/config/import",
      request,
      message: "Configuration import failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to import configuration",
      },
      {
        status: 500,
      },
    );
  }
}
