import { NextResponse } from "next/server";

import { ingestForwardedEmail } from "@/lib/email/forwarding";

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
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON payload",
      },
      {
        status: 400,
      },
    );
  }

  const result = await ingestForwardedEmail(payload, getForwardingSecret(request));

  if (!result.ok) {
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
}
