import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { OfferEmailDraftError } from "@/lib/email/drafts";
import { logRouteError } from "@/lib/observability/error-logging";
import { FeatureAccessError } from "@/server/application/entitlements/entitlement-service";
import { generateOfferDraftForViewer } from "@/server/facades/email-facade";

const generateDraftRequestSchema = z.object({
  jobOfferId: z.string().trim().min(1),
});

export const runtime = "nodejs";

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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/email/drafts/generate",
      request,
      message: "Invalid JSON payload received during draft generation",
      error,
      status: 400,
      metadata: {
        userId: viewer.userId,
      },
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

  const parsed = generateDraftRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid draft generation payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const draft = await generateOfferDraftForViewer(viewer, parsed.data.jobOfferId);

    return NextResponse.json(draft, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof OfferEmailDraftError || error instanceof FeatureAccessError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/email/drafts/generate",
        request,
        message: "Draft generation failed with a handled domain error",
        error,
        status: error.status,
        metadata: {
          userId: viewer.userId,
          jobOfferId: parsed.data.jobOfferId,
        },
      });

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    logRouteError({
      route: "/api/email/drafts/generate",
      request,
      message: "Draft generation failed with an unexpected error",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        jobOfferId: parsed.data.jobOfferId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to generate draft",
      },
      {
        status: 500,
      },
    );
  }
}
