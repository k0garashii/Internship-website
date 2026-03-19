import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  forwardingProvisionRequestSchema,
  getForwardingSourceSnapshot,
  provisionForwardingSource,
} from "@/lib/email/forwarding";

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

  return NextResponse.json(await getForwardingSourceSnapshot(viewer), {
    status: 200,
  });
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
  } catch {}

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

  return NextResponse.json(await provisionForwardingSource(viewer), {
    status: 200,
  });
}
