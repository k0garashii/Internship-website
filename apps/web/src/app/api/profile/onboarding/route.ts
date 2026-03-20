import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import {
  ProfileOnboardingError,
  saveProfileOnboarding,
} from "@/lib/profile/onboarding";

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
      route: "/api/profile/onboarding",
      request,
      message: "Invalid JSON payload received during onboarding save",
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
    const result = await saveProfileOnboarding(viewer, payload);

    return NextResponse.json(
      {
        savedAt: result.savedAt,
        normalizedUrls: result.normalizedUrls,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof ProfileOnboardingError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/profile/onboarding",
        request,
        message: "Onboarding save failed with a handled domain error",
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
      route: "/api/profile/onboarding",
      request,
      message: "Onboarding save failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to save profile",
      },
      {
        status: 500,
      },
    );
  }
}
