import type { OfferLifecycleStatus, SearchRunStatus, FeedbackDecision } from "@prisma/client";

import { db } from "@/lib/db";
import { buildSignalsFromOfferRecord, recordSearchBehaviorEvent } from "@/server/application/personalization/search-behavior-service";
import type {
  NormalizedOpportunity,
  OfferProfileMatch,
  OfferProfileMatchBreakdownItem,
  PersistedOfferDetailResult,
  PersistedOfferLifecycleStatus,
  PersistedOfferFeedbackDecision,
  PersistedOfferListItem,
  PersistedOfferListResult,
} from "@/lib/search/types";

export class SearchOfferListingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SearchOfferListingError";
  }
}

export type DeletedPersistedOfferResult = {
  deletedOfferId: string;
  deletedOfferTitle: string;
  deletedDraftCount: number;
};

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapLifecycleStatus(status: OfferLifecycleStatus): PersistedOfferLifecycleStatus {
  return status;
}

function mapFeedbackDecision(
  decision: FeedbackDecision | null | undefined,
): PersistedOfferFeedbackDecision | null {
  return decision ?? null;
}

function mapSearchRunStatus(status: SearchRunStatus | null | undefined) {
  return status ?? null;
}

function labelFromScore(score: number | null): OfferProfileMatch["label"] | null {
  if (typeof score !== "number") {
    return null;
  }

  if (score >= 82) {
    return "Tres forte";
  }

  if (score >= 68) {
    return "Forte";
  }

  if (score >= 52) {
    return "Intermediaire";
  }

  return "Exploratoire";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asBreakdownItemArray(value: unknown): OfferProfileMatchBreakdownItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => isRecord(item))
    .map((item) => ({
      criterion: typeof item.criterion === "string" ? item.criterion : "Critere",
      awarded: typeof item.awarded === "number" ? item.awarded : 0,
      max: typeof item.max === "number" ? item.max : 0,
      reason: typeof item.reason === "string" ? item.reason : "",
      matchedTerms: asStringArray(item.matchedTerms),
    }))
    .filter((item) => item.awarded > 0);
}

function asNormalizedOpportunity(value: unknown): NormalizedOpportunity | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.rawSourceId !== "string" ||
    typeof value.fingerprint !== "string" ||
    typeof value.origin !== "string" ||
    typeof value.sourceKind !== "string" ||
    typeof value.sourceProvider !== "string" ||
    typeof value.sourceLabel !== "string" ||
    typeof value.capturedAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    rawSourceId: value.rawSourceId,
    fingerprint: value.fingerprint,
    origin: value.origin as NormalizedOpportunity["origin"],
    sourceKind: value.sourceKind as NormalizedOpportunity["sourceKind"],
    sourceProvider: value.sourceProvider,
    sourceLabel: value.sourceLabel,
    title: typeof value.title === "string" ? value.title : null,
    companyName: typeof value.companyName === "string" ? value.companyName : null,
    locationLabel: typeof value.locationLabel === "string" ? value.locationLabel : null,
    countryCode: typeof value.countryCode === "string" ? value.countryCode : null,
    contractType: typeof value.contractType === "string" ? value.contractType : null,
    workMode: typeof value.workMode === "string" ? value.workMode : null,
    description: typeof value.description === "string" ? value.description : null,
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : null,
    publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : null,
    capturedAt: value.capturedAt,
    signal: typeof value.signal === "string" ? value.signal : null,
  };
}

function toDeduplicationState(value: unknown) {
  const deduplication =
    isRecord(value) && isRecord(value.deduplication) ? value.deduplication : null;

  return {
    sourceFingerprints: deduplication ? asStringArray(deduplication.sourceFingerprints) : [],
    sourceOfferIds: deduplication ? asStringArray(deduplication.sourceOfferIds) : [],
    sourceUrls: deduplication ? asStringArray(deduplication.sourceUrls) : [],
    providers: deduplication ? asStringArray(deduplication.providers) : [],
  };
}

function extractOfferMetadata(rawPayload: unknown) {
  if (!isRecord(rawPayload)) {
    return {
      matchedQueryLabels: [] as string[],
      matchedKeywords: [] as string[],
      matchingBreakdown: [] as OfferProfileMatchBreakdownItem[],
      normalizedOpportunity: null as NormalizedOpportunity | null,
      deduplication: {
        sourceFingerprints: [] as string[],
        sourceOfferIds: [] as string[],
        sourceUrls: [] as string[],
        providers: [] as string[],
      },
    };
  }

  const rawOffer = isRecord(rawPayload.offer) ? rawPayload.offer : null;

  return {
    matchedQueryLabels: rawOffer ? asStringArray(rawOffer.matchedQueryLabels) : [],
    matchedKeywords: rawOffer ? asStringArray(rawOffer.matchedKeywords) : [],
    matchingBreakdown:
      rawOffer && isRecord(rawOffer.matching)
        ? asBreakdownItemArray(rawOffer.matching.breakdown)
        : [],
    normalizedOpportunity: asNormalizedOpportunity(rawPayload.normalizedOpportunity),
    deduplication: toDeduplicationState(rawPayload),
  };
}

function buildListingSummary(offerCount: number, statusCounts: PersistedOfferListResult["statusCounts"]) {
  if (offerCount === 0) {
    return "Aucune offre persistee pour le moment.";
  }

  const shortlistedCount = statusCounts.SHORTLISTED ?? 0;
  const appliedCount = statusCounts.APPLIED ?? 0;
  const archivedCount = statusCounts.ARCHIVED ?? 0;

  return `${offerCount} offre(s) persistee(s), ${shortlistedCount} shortlist, ${appliedCount} candidature(s) et ${archivedCount} archivee(s).`;
}

export async function listPersistedOffersForUser(
  userId: string,
): Promise<PersistedOfferListResult> {
  const offers = await db.jobOffer.findMany({
    where: {
      userId,
    },
    orderBy: [
      {
        lastSeenAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      id: true,
      title: true,
      companyName: true,
      sourceSite: true,
      sourceUrl: true,
      locationLabel: true,
      status: true,
      postedAt: true,
      firstSeenAt: true,
      lastSeenAt: true,
      searchMatches: {
        orderBy: [
          {
            discoveredAt: "desc",
          },
        ],
        take: 1,
        select: {
          rank: true,
          rawScore: true,
          matchExplanation: true,
          isShortlisted: true,
          searchRun: {
            select: {
              id: true,
              label: true,
              status: true,
            },
          },
        },
      },
      feedbackEntries: {
        orderBy: [
          {
            updatedAt: "desc",
          },
        ],
        take: 1,
        select: {
          decision: true,
          note: true,
        },
      },
    },
  });

  const items: PersistedOfferListItem[] = offers.map((offer) => {
    const latestMatch = offer.searchMatches[0] ?? null;
    const latestFeedback = offer.feedbackEntries[0] ?? null;

    return {
      id: offer.id,
      title: offer.title,
      companyName: offer.companyName,
      sourceSite: offer.sourceSite,
      sourceUrl: offer.sourceUrl,
      locationLabel: offer.locationLabel,
      lifecycleStatus: mapLifecycleStatus(offer.status),
      postedAt: toIsoString(offer.postedAt),
      firstSeenAt: offer.firstSeenAt.toISOString(),
      lastSeenAt: offer.lastSeenAt.toISOString(),
      latestMatchScore:
        typeof latestMatch?.rawScore === "number" ? Math.round(latestMatch.rawScore) : null,
      latestRank: latestMatch?.rank ?? null,
      latestSearchRunId: latestMatch?.searchRun.id ?? null,
      latestSearchLabel: latestMatch?.searchRun.label ?? null,
      latestSearchStatus: mapSearchRunStatus(latestMatch?.searchRun.status),
      matchExplanation: latestMatch?.matchExplanation ?? null,
      isShortlisted: latestMatch?.isShortlisted ?? false,
      latestFeedbackDecision: mapFeedbackDecision(latestFeedback?.decision),
      latestFeedbackNote: latestFeedback?.note ?? null,
    };
  });

  const statusCounts = items.reduce<PersistedOfferListResult["statusCounts"]>((counts, offer) => {
    counts[offer.lifecycleStatus] = (counts[offer.lifecycleStatus] ?? 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    summary: buildListingSummary(items.length, statusCounts),
    offerCount: items.length,
    statusCounts,
    offers: items,
  };
}

export async function getPersistedOfferDetailForUser(
  userId: string,
  offerId: string,
): Promise<PersistedOfferDetailResult> {
  const offer = await db.jobOffer.findFirst({
    where: {
      id: offerId,
      userId,
    },
    select: {
      id: true,
      title: true,
      companyName: true,
      sourceSite: true,
      sourceUrl: true,
      sourceKind: true,
      status: true,
      locationLabel: true,
      countryCode: true,
      employmentType: true,
      workMode: true,
      postedAt: true,
      firstSeenAt: true,
      lastSeenAt: true,
      description: true,
      rawPayload: true,
      searchMatches: {
        orderBy: [
          {
            discoveredAt: "desc",
          },
        ],
        select: {
          id: true,
          discoveredAt: true,
          rank: true,
          rawScore: true,
          normalizedScore: true,
          matchExplanation: true,
          isShortlisted: true,
          searchRun: {
            select: {
              id: true,
              label: true,
              status: true,
            },
          },
        },
      },
      feedbackEntries: {
        orderBy: [
          {
            updatedAt: "desc",
          },
        ],
        select: {
          id: true,
          decision: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      drafts: {
        orderBy: [
          {
            updatedAt: "desc",
          },
        ],
        select: {
          id: true,
          status: true,
          subject: true,
          generatedBy: true,
          personalizationSummary: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!offer) {
    throw new SearchOfferListingError("Offer not found", 404);
  }

  const latestMatch = offer.searchMatches[0] ?? null;
  const latestFeedback = offer.feedbackEntries[0] ?? null;
  const metadata = extractOfferMetadata(offer.rawPayload);

  return {
    generatedAt: new Date().toISOString(),
    offer: {
      id: offer.id,
      title: offer.title,
      companyName: offer.companyName,
      sourceSite: offer.sourceSite,
      sourceUrl: offer.sourceUrl,
      sourceKind: offer.sourceKind,
      lifecycleStatus: mapLifecycleStatus(offer.status),
      locationLabel: offer.locationLabel,
      countryCode: offer.countryCode,
      employmentType: offer.employmentType,
      workMode: offer.workMode,
      postedAt: toIsoString(offer.postedAt),
      firstSeenAt: offer.firstSeenAt.toISOString(),
      lastSeenAt: offer.lastSeenAt.toISOString(),
      description: offer.description,
      latestMatchScore:
        typeof latestMatch?.rawScore === "number" ? Math.round(latestMatch.rawScore) : null,
      latestMatchLabel:
        typeof latestMatch?.rawScore === "number"
          ? labelFromScore(Math.round(latestMatch.rawScore))
          : null,
      latestMatchExplanation: latestMatch?.matchExplanation ?? null,
      latestFeedbackDecision: mapFeedbackDecision(latestFeedback?.decision),
      latestFeedbackNote: latestFeedback?.note ?? null,
      matchedQueryLabels: metadata.matchedQueryLabels,
      matchedKeywords: metadata.matchedKeywords,
      matchingBreakdown: metadata.matchingBreakdown,
      normalizedOpportunity: metadata.normalizedOpportunity,
      deduplication: metadata.deduplication,
    },
    searchMatches: offer.searchMatches.map((entry) => ({
      id: entry.id,
      discoveredAt: entry.discoveredAt.toISOString(),
      rank: entry.rank,
      rawScore: typeof entry.rawScore === "number" ? Math.round(entry.rawScore) : null,
      normalizedScore:
        typeof entry.normalizedScore === "number"
          ? Math.round(entry.normalizedScore * 100)
          : null,
      matchExplanation: entry.matchExplanation,
      isShortlisted: entry.isShortlisted,
      searchRunId: entry.searchRun.id,
      searchRunLabel: entry.searchRun.label,
      searchRunStatus: entry.searchRun.status,
    })),
    feedbackEntries: offer.feedbackEntries.map((entry) => ({
      id: entry.id,
      decision: entry.decision,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
    drafts: offer.drafts.map((entry) => ({
      id: entry.id,
      status: entry.status,
      subject: entry.subject,
      generatedBy: entry.generatedBy,
      personalizationSummary: entry.personalizationSummary,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  };
}

export async function deletePersistedOfferForUser(
  userId: string,
  offerId: string,
): Promise<DeletedPersistedOfferResult> {
  const offer = await db.jobOffer.findFirst({
    where: {
      id: offerId,
      userId,
    },
    select: {
      id: true,
      title: true,
      workspaceId: true,
      companyName: true,
      locationLabel: true,
      employmentType: true,
      workMode: true,
      sourceUrl: true,
      rawPayload: true,
    },
  });

  if (!offer) {
    throw new SearchOfferListingError("Offer not found", 404);
  }

  await recordSearchBehaviorEvent(
    {
      userId,
      workspaceId: offer.workspaceId ?? undefined,
    },
    {
      type: "OFFER_DELETED",
      jobOfferId: offer.id,
      companyName: offer.companyName,
      sourceUrl: offer.sourceUrl,
      signals: buildSignalsFromOfferRecord(offer).map((signal) => ({
        ...signal,
        polarity: "NEGATIVE",
      })),
      metadata: {
        offerTitle: offer.title,
      },
    },
  );

  const deletedDraftCount = await db.$transaction(async (tx) => {
    const deletedDrafts = await tx.emailDraft.deleteMany({
      where: {
        userId,
        jobOfferId: offer.id,
      },
    });

    await tx.jobOffer.delete({
      where: {
        id: offer.id,
      },
    });

    return deletedDrafts.count;
  });

  return {
    deletedOfferId: offer.id,
    deletedOfferTitle: offer.title,
    deletedDraftCount,
  };
}
