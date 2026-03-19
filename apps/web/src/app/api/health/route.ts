import { NextResponse } from "next/server";

import { stackDecision } from "@/lib/stack";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    project: stackDecision.project,
    frontend: stackDecision.frontend.summary,
    backend: stackDecision.backend.summary,
    data: stackDecision.data.summary,
    nextBacklog: stackDecision.nextBacklog,
  });
}
