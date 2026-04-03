import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import {
  searchBehaviorEventTypes,
} from "@/lib/profile/personalization-signals";
import {
  searchPreferenceAxes,
  searchPreferencePolarities,
  searchProfileSignalSources,
} from "@/lib/profile/personalization-model";
import {
  buildSignalsFromCompanyTarget,
  buildSignalsFromOfferRecord,
  recordSearchBehaviorEvent,
  type SearchBehaviorSignal,
} from "@/server/application/personalization/search-behavior-service";

export const runtime = "nodejs";

const optionalStringSchema = z
  .union([z.string().trim(), z.null(), z.undefined()])
  .transform((value) => (value ? value : null))
  .default(null);

const interactionSignalSchema = z.object({
  axis: z.enum(searchPreferenceAxes),
  value: z.string().trim().min(1).max(120),
  polarity: z.enum(searchPreferencePolarities).optional(),
  weight: z.number().min(0.1).max(8).optional(),
  source: z.enum(searchProfileSignalSources).optional(),
});

const offerContextSchema = z.object({
  title: z.string().trim().min(1).max(240),
  companyName: z.string().trim().min(1).max(160),
  locationLabel: optionalStringSchema,
  employmentType: optionalStringSchema,
  workMode: optionalStringSchema,
  matchedQueryLabels: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  matchedKeywords: z.array(z.string().trim().min(1).max(120)).max(16).default([]),
});

const companyContextSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  companySlug: optionalStringSchema,
  matchedSignals: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  tags: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  atsProvider: optionalStringSchema,
});

const interactionSchema = z.object({
  type: z.enum(searchBehaviorEventTypes),
  queryText: optionalStringSchema,
  companyName: optionalStringSchema,
  companySlug: optionalStringSchema,
  sourceUrl: optionalStringSchema,
  jobOfferId: optionalStringSchema,
  searchRunId: optionalStringSchema,
  dedupeKey: optionalStringSchema,
  signals: z.array(interactionSignalSchema).max(20).default([]),
  offerContext: offerContextSchema.optional(),
  companyContext: companyContextSchema.optional(),
  metadata: z.record(z.string(), z.any()).nullish(),
  occurredAt: z.string().datetime().optional(),
});

function computeImplicitWeightMultiplier(
  type: z.infer<typeof interactionSchema>["type"],
  metadata: Record<string, unknown> | null | undefined,
) {
  const dwellMs =
    typeof metadata?.dwellMs === "number" && Number.isFinite(metadata.dwellMs)
      ? metadata.dwellMs
      : 0;
  const ctaKind = typeof metadata?.ctaKind === "string" ? metadata.ctaKind : null;

  let multiplier = 1;

  if (type === "SEARCH_RESULT_EXPANDED") {
    if (dwellMs >= 60000) {
      multiplier += 0.8;
    } else if (dwellMs >= 30000) {
      multiplier += 0.55;
    } else if (dwellMs >= 15000) {
      multiplier += 0.35;
    } else if (dwellMs >= 7000) {
      multiplier += 0.2;
    }
  }

  if (ctaKind === "external_offer" || ctaKind === "company_career_offer") {
    multiplier += 0.2;
  } else if (ctaKind === "offer_detail" || ctaKind === "company_offers_page") {
    multiplier += 0.12;
  } else if (ctaKind === "official_site") {
    multiplier += 0.08;
  }

  return Math.min(multiplier, 2.4);
}

function mergeInteractionSignals(input: z.infer<typeof interactionSchema>) {
  const signals: SearchBehaviorSignal[] = [...input.signals];

  if (input.offerContext) {
    signals.push(
      ...buildSignalsFromOfferRecord({
        title: input.offerContext.title,
        companyName: input.offerContext.companyName,
        locationLabel: input.offerContext.locationLabel,
        employmentType: input.offerContext.employmentType,
        workMode: input.offerContext.workMode,
        rawPayload: {
          offer: {
            matchedQueryLabels: input.offerContext.matchedQueryLabels,
            matchedKeywords: input.offerContext.matchedKeywords,
          },
        },
      }),
    );
  }

  if (input.companyContext) {
    signals.push(
      ...buildSignalsFromCompanyTarget({
        companyName: input.companyContext.companyName,
        companySlug: input.companyContext.companySlug,
        matchedSignals: input.companyContext.matchedSignals,
        tags: input.companyContext.tags,
        atsProvider: input.companyContext.atsProvider,
      }),
    );
  }

  const multiplier = computeImplicitWeightMultiplier(input.type, input.metadata);

  return signals.map((signal) => ({
    ...signal,
    weight: Math.min(Math.max((signal.weight ?? 1) * multiplier, 0.1), 8),
  }));
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

  try {
    const body = interactionSchema.parse(await request.json());
    const signals = mergeInteractionSignals(body);

    await recordSearchBehaviorEvent(viewer, {
      type: body.type,
      queryText: body.queryText,
      companyName: body.companyName ?? body.companyContext?.companyName ?? body.offerContext?.companyName ?? null,
      companySlug: body.companySlug ?? body.companyContext?.companySlug ?? null,
      sourceUrl: body.sourceUrl,
      jobOfferId: body.jobOfferId,
      searchRunId: body.searchRunId,
      dedupeKey: body.dedupeKey,
      metadata: body.metadata ?? null,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      signals,
    });

    return NextResponse.json(
      {
        ok: true,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid interaction payload",
          fieldErrors: z.flattenError(error).fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    logRouteError({
      route: "/api/search/interactions",
      request,
      message: "Unable to persist implicit search interaction",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to persist interaction",
      },
      {
        status: 500,
      },
    );
  }
}
