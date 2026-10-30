import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import { exportAccountData } from "@/server/application/account/account-service";

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
    const data = await exportAccountData(viewer.userId);
    const fileDate = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="internship-scrapper-export-${fileDate}.json"`,
      },
    });
  } catch (error) {
    logRouteError({
      route: "/api/account/export",
      request,
      message: "Account data export failed",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to export account data",
      },
      {
        status: 500,
      },
    );
  }
}
