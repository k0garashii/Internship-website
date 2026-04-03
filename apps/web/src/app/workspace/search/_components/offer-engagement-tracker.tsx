"use client";

import { useEffect, useRef } from "react";

import { trackSearchInteraction } from "./search-interactions";

type Props = {
  jobOfferId?: string | null;
  sourceUrl?: string | null;
  offerContext: {
    title: string;
    companyName: string;
    locationLabel?: string | null;
    employmentType?: string | null;
    workMode?: string | null;
    matchedQueryLabels?: string[];
    matchedKeywords?: string[];
  };
  origin: string;
};

const MIN_DWELL_MS = 7000;
const TARGET_DWELL_MS = 25000;

export function OfferEngagementTracker({
  jobOfferId,
  sourceUrl,
  offerContext,
  origin,
}: Props) {
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    const startedAt = Date.now();

    function emitIfNeeded() {
      if (hasTrackedRef.current) {
        return;
      }

      const dwellMs = Date.now() - startedAt;

      if (dwellMs < MIN_DWELL_MS) {
        return;
      }

      hasTrackedRef.current = true;
      void trackSearchInteraction({
        type: "SEARCH_RESULT_EXPANDED",
        jobOfferId: jobOfferId ?? null,
        sourceUrl: sourceUrl ?? null,
        offerContext,
        dedupeKey: `${origin}:${jobOfferId ?? offerContext.title}:expanded`,
        metadata: {
          dwellMs,
          ctaKind: "offer_dwell",
          origin,
        },
      });
    }

    const timer = window.setTimeout(emitIfNeeded, TARGET_DWELL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        emitIfNeeded();
      }
    }

    window.addEventListener("pagehide", emitIfNeeded);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", emitIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      emitIfNeeded();
    };
  }, [jobOfferId, offerContext, origin, sourceUrl]);

  return null;
}
