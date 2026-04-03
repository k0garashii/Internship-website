"use client";

type InteractionSignal = {
  axis:
    | "ROLE"
    | "DOMAIN"
    | "KEYWORD"
    | "TECHNOLOGY"
    | "LOCATION"
    | "WORK_MODE"
    | "EMPLOYMENT_TYPE"
    | "COMPANY"
    | "COMPANY_TYPE"
    | "OUTCOME";
  value: string;
  polarity?: "POSITIVE" | "NEGATIVE";
  weight?: number;
};

type OfferInteractionContext = {
  title: string;
  companyName: string;
  locationLabel?: string | null;
  employmentType?: string | null;
  workMode?: string | null;
  matchedQueryLabels?: string[];
  matchedKeywords?: string[];
};

type CompanyInteractionContext = {
  companyName: string;
  companySlug?: string | null;
  matchedSignals?: string[];
  tags?: string[];
  atsProvider?: string | null;
};

export type SearchInteractionPayload = {
  type:
    | "SEARCH_RESULT_OPENED"
    | "SEARCH_RESULT_EXPANDED"
    | "COMPANY_TARGET_OPENED"
    | "ATS_SOURCE_OPENED";
  queryText?: string | null;
  companyName?: string | null;
  companySlug?: string | null;
  sourceUrl?: string | null;
  jobOfferId?: string | null;
  searchRunId?: string | null;
  dedupeKey?: string | null;
  signals?: InteractionSignal[];
  offerContext?: OfferInteractionContext;
  companyContext?: CompanyInteractionContext;
  metadata?: Record<string, unknown> | null;
};

function buildRequestBody(payload: SearchInteractionPayload) {
  return JSON.stringify({
    ...payload,
    signals: payload.signals ?? [],
    metadata: payload.metadata ?? null,
    offerContext: payload.offerContext
      ? {
          ...payload.offerContext,
          matchedQueryLabels: payload.offerContext.matchedQueryLabels ?? [],
          matchedKeywords: payload.offerContext.matchedKeywords ?? [],
        }
      : undefined,
    companyContext: payload.companyContext
      ? {
          ...payload.companyContext,
          matchedSignals: payload.companyContext.matchedSignals ?? [],
          tags: payload.companyContext.tags ?? [],
        }
      : undefined,
  });
}

export function trackSearchInteraction(payload: SearchInteractionPayload) {
  const body = buildRequestBody(payload);

  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });

      if (navigator.sendBeacon("/api/search/interactions", blob)) {
        return Promise.resolve();
      }
    }
  } catch {
    // Fall through to fetch.
  }

  return fetch("/api/search/interactions", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
    },
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}
