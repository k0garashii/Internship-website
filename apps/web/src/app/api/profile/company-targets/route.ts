import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { generateCompanyTargetSuggestions } from "@/lib/company-targets/suggestions";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logRouteError } from "@/lib/observability/error-logging";
import { FeatureAccessError, assertWorkspaceFeatureAccess } from "@/server/application/entitlements/entitlement-service";
import { getEffectiveInferredPreferences } from "@/server/application/personalization/profile-inference-service";
import { requireViewerWorkspaceId } from "@/lib/security/ownership";
import { WorkspaceFeature } from "@prisma/client";

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
    await assertWorkspaceFeatureAccess(
      requireViewerWorkspaceId(viewer),
      WorkspaceFeature.COMPANY_TARGETING,
    );

    const config = await exportUserConfig(viewer);
    const inferredPreferences = await getEffectiveInferredPreferences(
      viewer.userId,
      requireViewerWorkspaceId(viewer),
    );
    const result = await generateCompanyTargetSuggestions(
      config.personalProfile,
      config.searchTargets,
      config.companyWatchlist,
      inferredPreferences,
    );

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof UserConfigError || error instanceof FeatureAccessError) {
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
          fieldErrors: error instanceof UserConfigError ? error.fieldErrors ?? {} : {},
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
