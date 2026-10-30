import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Public endpoint: keep it to a liveness signal without internal details.
export function GET() {
  return NextResponse.json({
    status: "ok",
  });
}
