import { NextResponse } from "next/server";

import { ingestForwardedEmail } from "@/lib/email/forwarding";
import { logRouteError } from "@/lib/observability/error-logging";

export const runtime = "nodejs";

function getForwardingSecret(request: Request) {
  return (
    request.headers.get("x-forwarding-secret") ??
    new URL(request.url).searchParams.get("secret")
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/email/forwarding/intake",
      request,
      message: "Invalid JSON payload received during forwarding intake",
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
    const result = await ingestForwardedEmail(payload, getForwardingSecret(request));

    if (!result.ok) {
      logRouteError({
        level: result.status >= 500 ? "error" : "warn",
        route: "/api/email/forwarding/intake",
        request,
        message: "Forwarding intake failed with a handled domain error",
        status: result.status,
        metadata: {
          error: result.error,
        },
      });

      return NextResponse.json(
        {
          error: result.error,
        },
        {
          status: result.status,
        },
      );
    }

    return NextResponse.json(result, {
      status: result.status,
    });
  } catch (error) {
    logRouteError({
      route: "/api/email/forwarding/intake",
      request,
      message: "Forwarding intake failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to ingest forwarded email",
      },
      {
        status: 500,
      },
    );
  }
}
