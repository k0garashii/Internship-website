import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { getSearchPersonalizationSnapshot } from "@/server/application/personalization/profile-inference-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
    const personalization = await getSearchPersonalizationSnapshot(
      viewer.userId,
      viewer.workspaceId,
    );

    return NextResponse.json(personalization, {
      status: 200,
    });
  } catch (error) {
    logRouteError({
      route: "/api/profile/inference",
      request,
      message: "Unable to load inferred profile snapshot",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to load inferred profile snapshot",
      },
      {
        status: 500,
      },
    );
  }
}
