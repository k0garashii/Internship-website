import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  companyTargetDiscoveryRequestSchema,
  discoverCareerSourcesForTargets,
} from "@/lib/company-targets/discovery";

export const runtime = "nodejs";

async function handleCompanyTargetDiscovery(request: Request) {
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

  const parsed = companyTargetDiscoveryRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid company target discovery payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const result = await discoverCareerSourcesForTargets(parsed.data.targets);

    return NextResponse.json(result, {
      status: 200,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Unable to discover career sources for the provided targets",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  return handleCompanyTargetDiscovery(request);
}
