import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { generateCompanyTargetSuggestions } from "@/lib/company-targets/suggestions";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logRouteError } from "@/lib/observability/error-logging";

export const runtime = "nodejs";

async function handleCompanyTargets() {
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
    const result = await generateCompanyTargetSuggestions(
      config.personalProfile,
      config.searchTargets,
      config.companyWatchlist,
    );

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof UserConfigError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/profile/company-targets",
        message: "Company target generation failed with a handled domain error",
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
      route: "/api/profile/company-targets",
      message: "Company target generation failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to generate company targets",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET() {
  return handleCompanyTargets();
}

export async function POST() {
  return handleCompanyTargets();
}
