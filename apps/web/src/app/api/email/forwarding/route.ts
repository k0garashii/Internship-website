import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import {
  forwardingProvisionRequestSchema,
  getForwardingSourceSnapshot,
  provisionForwardingSource,
} from "@/lib/email/forwarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    return NextResponse.json(await getForwardingSourceSnapshot(viewer), {
      status: 200,
    });
  } catch (error) {
    logRouteError({
      route: "/api/email/forwarding",
      message: "Forwarding snapshot retrieval failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to load forwarding source",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
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

  let payload: unknown = undefined;

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/email/forwarding",
      request,
      message: "Invalid JSON payload received during forwarding provisioning",
      error,
      status: 400,
    });
  }

  const parsed = forwardingProvisionRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid forwarding provisioning payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    return NextResponse.json(await provisionForwardingSource(viewer), {
      status: 200,
    });
  } catch (error) {
    logRouteError({
      route: "/api/email/forwarding",
      request,
      message: "Forwarding provisioning failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to provision forwarding source",
      },
      {
        status: 500,
      },
    );
  }
}
