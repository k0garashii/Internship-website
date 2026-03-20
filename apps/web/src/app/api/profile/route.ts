import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  ProfileOnboardingError,
  saveProfileOnboarding,
} from "@/lib/profile/onboarding";
import {
  getProfileFormData,
  mapAccountToProfileDraft,
} from "@/lib/profile/profile-form-data";
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

  const account = await getProfileFormData(viewer.userId);

  if (!account) {
    return NextResponse.json(
      {
        error: "User not found",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json(mapAccountToProfileDraft(account), {
    status: 200,
  });
}

export async function PATCH(request: Request) {
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
      route: "/api/profile",
      request,
      message: "Invalid JSON payload received during profile update",
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
    const account = await getProfileFormData(viewer.userId);

    if (!account) {
      return NextResponse.json(
        {
          error: "User not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        savedAt: result.savedAt,
        profile: mapAccountToProfileDraft(account),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof ProfileOnboardingError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/profile",
        request,
        message: "Profile update failed with a handled domain error",
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
      route: "/api/profile",
      request,
      message: "Profile update failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to update profile",
      },
      {
        status: 500,
      },
    );
  }
}
