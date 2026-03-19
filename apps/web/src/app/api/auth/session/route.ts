import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";

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

  return NextResponse.json(
    {
      user: viewer,
    },
    {
      status: 200,
    },
  );
}
