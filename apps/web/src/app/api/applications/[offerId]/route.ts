import { NextResponse } from "next/server";

import { ApplicationUpdateError, updateApplicationForUser } from "@/lib/applications/pipeline";
import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { offerId } = await params;

  try {
    const application = await updateApplicationForUser(
      viewer.userId,
      offerId,
      await request.json().catch(() => null),
    );

    return NextResponse.json({ application });
  } catch (error) {
    if (error instanceof ApplicationUpdateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logRouteError({
      route: "/api/applications/[offerId]",
      request,
      message: "Application update failed",
      error,
      status: 500,
      metadata: { userId: viewer.userId, offerId },
    });

    return NextResponse.json({ error: "Impossible de mettre à jour la candidature." }, { status: 500 });
  }
}
