import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { getEmailIngestionStrategy } from "@/lib/email/strategy";

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

  return NextResponse.json(getEmailIngestionStrategy(), {
    status: 200,
  });
}
