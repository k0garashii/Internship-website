import { NextResponse } from "next/server";
import { WorkspaceFeature } from "@prisma/client";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  companyTargetDiscoveryRequestSchema,
  discoverCareerSourcesForTargets,
} from "@/lib/company-targets/discovery";
import { logRouteError } from "@/lib/observability/error-logging";
import { requireViewerWorkspaceId } from "@/lib/security/ownership";
import { FeatureAccessError, assertWorkspaceFeatureAccess } from "@/server/application/entitlements/entitlement-service";

export const runtime = "nodejs";

async function handleCompanyTargetDiscovery(request: Request) {
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
      route: "/api/profile/company-targets/discovery",
      request,
      message: "Invalid JSON payload received during company target discovery",
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

  const parsed = companyTargetDiscoveryRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid company target discovery payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    await assertWorkspaceFeatureAccess(
      requireViewerWorkspaceId(viewer),
      WorkspaceFeature.COMPANY_TARGETING,
    );

    const result = await discoverCareerSourcesForTargets(parsed.data.targets);

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof FeatureAccessError) {
      logRouteError({
        level: "warn",
        route: "/api/profile/company-targets/discovery",
        request,
        message: "Company target discovery blocked by workspace entitlements",
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
      route: "/api/profile/company-targets/discovery",
      request,
      message: "Company target discovery failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to discover career sources for the provided targets",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  return handleCompanyTargetDiscovery(request);
}
