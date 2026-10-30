import { NextResponse } from "next/server";

import { logRouteError } from "@/lib/observability/error-logging";
import { safeEqualStrings } from "@/lib/security/secrets";
import { runScheduledMaintenance } from "@/server/application/alerts/daily-maintenance-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 60 s is allowed on every Vercel plan; the work is sliced to fit in it.
export const maxDuration = 60;
const TIME_BUDGET_MS = 50_000;

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the variable is set.
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization");

  return Boolean(secret && header && safeEqualStrings(header, `Bearer ${secret}`));
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runScheduledMaintenance({ deadline: startedAt + TIME_BUDGET_MS });

    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...summary });
  } catch (error) {
    logRouteError({
      route: "/api/cron/maintenance",
      request,
      message: "Scheduled maintenance failed",
      error,
      status: 500,
    });

    return NextResponse.json({ error: "Scheduled maintenance failed" }, { status: 500 });
  }
}
