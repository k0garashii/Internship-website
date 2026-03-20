import {
  EmploymentType,
  OfferLifecycleStatus,
  OfferSourceKind,
  SearchRunStatus,
  WorkMode,
} from "@prisma/client";

import { db } from "@/lib/db";
import type { SearchDiscoveryOffer, SearchDiscoveryResult } from "@/lib/search/types";

export class SearchPersistenceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SearchPersistenceError";
  }
}

export type SearchPersistenceSummary = {
  searchRunId: string;
  persistedOfferCount: number;
  createdOfferCount: number;
  updatedOfferCount: number;
};

type ExistingPersistedOffer = {
  id: string;
  fingerprint: string;
  title: string;
  companyName: string;
  locationLabel: string | null;
  sourceUrl: string;
  externalId: string | null;
  postedAt: Date | null;
  rawPayload: unknown;
};

type DeduplicationState = {
  sourceFingerprints: string[];
  sourceOfferIds: string[];
  sourceUrls: string[];
  providers: string[];
};

function truncate(value: string, length: number) {
  return value.length > length ? value.slice(0, length - 1) : value;
}

function buildSearchRunLabel(generatedAt: string) {
  return `Recherche ${new Date(generatedAt).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  })}`;
}

function buildSearchRunQueryText(result: SearchDiscoveryResult) {
  const queryText = result.queryExecutions.map((execution) => execution.queryText).join(" | ");

  return queryText.length > 0 ? truncate(queryText, 1000) : null;
}

function mapOfferSourceKind(sourceKind: string | null | undefined) {
  switch (sourceKind) {
    case "COMPANY_CAREERS":
      return OfferSourceKind.COMPANY_CAREERS;
    case "JOB_BOARD":
      return OfferSourceKind.JOB_BOARD;
    default:
      return OfferSourceKind.OTHER;
  }
}

function mapEmploymentType(contractType: string | null) {
  switch (contractType) {
    case "internship":
      return EmploymentType.INTERNSHIP;
    case "apprenticeship":
      return EmploymentType.APPRENTICESHIP;
    case "full_time":
      return EmploymentType.FULL_TIME;
    case "part_time":
      return EmploymentType.PART_TIME;
    case "temporary":
      return EmploymentType.TEMPORARY;
    case "freelance":
      return EmploymentType.FREELANCE;
    default:
      return null;
  }
}

function mapWorkMode(remoteMode: string | null) {
  switch (remoteMode) {
    case "fulltime":
      return WorkMode.REMOTE;
    case "partial":
      return WorkMode.HYBRID;
    case "punctual":
      return WorkMode.FLEXIBLE;
    case "no":
      return WorkMode.ONSITE;
    default:
      return null;
  }
}

function buildMatchExplanation(offer: SearchDiscoveryOffer) {
  const notes = [
    offer.matching.summary,
    offer.matchedQueryLabels.length > 0 ? `Requetes: ${offer.matchedQueryLabels.join(", ")}` : null,
    offer.matchedKeywords.length > 0 ? `Mots cles: ${offer.matchedKeywords.join(", ")}` : null,
  ].filter(Boolean);

  return notes.length > 0 ? notes.join(" | ") : null;
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDeduplicationState(value: unknown): DeduplicationState {
  const deduplication =
    value && typeof value === "object" && "deduplication" in value
      ? (value as { deduplication?: Partial<DeduplicationState> }).deduplication
      : undefined;

  return {
    sourceFingerprints: Array.isArray(deduplication?.sourceFingerprints)
      ? deduplication.sourceFingerprints.filter((item): item is string => typeof item === "string")
      : [],
    sourceOfferIds: Array.isArray(deduplication?.sourceOfferIds)
      ? deduplication.sourceOfferIds.filter((item): item is string => typeof item === "string")
      : [],
    sourceUrls: Array.isArray(deduplication?.sourceUrls)
      ? deduplication.sourceUrls.filter((item): item is string => typeof item === "string")
      : [],
    providers: Array.isArray(deduplication?.providers)
      ? deduplication.providers.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function mergeDeduplicationState(
  current: DeduplicationState,
  incoming: {
    fingerprint: string;
    offerId: string;
    sourceUrl: string;
    provider: string;
  },
): DeduplicationState {
  return {
    sourceFingerprints: Array.from(new Set([...current.sourceFingerprints, incoming.fingerprint])),
    sourceOfferIds: Array.from(new Set([...current.sourceOfferIds, incoming.offerId])),
    sourceUrls: Array.from(new Set([...current.sourceUrls, incoming.sourceUrl])),
    providers: Array.from(new Set([...current.providers, incoming.provider])),
  };
}

function isPostedWithinTolerance(left: Date | null, right: string | null) {
  if (!left || !right) {
    return true;
  }

  const rightDate = new Date(right);

  if (Number.isNaN(rightDate.getTime())) {
    return true;
  }

  const distance = Math.abs(left.getTime() - rightDate.getTime());
  return distance <= 1000 * 60 * 60 * 24 * 21;
}

function findDuplicateOffer(
  existingOffers: ExistingPersistedOffer[],
  offer: SearchDiscoveryOffer,
  normalizedFingerprint: string,
) {
  const normalizedTitle = normalizeComparable(offer.title);
  const normalizedCompany = normalizeComparable(offer.companyName);
  const normalizedLocation = normalizeComparable(offer.locationLabel);

  return existingOffers.find((existingOffer) => {
    const deduplicationState = toDeduplicationState(existingOffer.rawPayload);

    if (
      existingOffer.fingerprint === normalizedFingerprint ||
      deduplicationState.sourceFingerprints.includes(normalizedFingerprint)
    ) {
      return true;
    }

    if (
      existingOffer.sourceUrl === offer.sourceUrl ||
      deduplicationState.sourceUrls.includes(offer.sourceUrl)
    ) {
      return true;
    }

    if (
      existingOffer.externalId === offer.id ||
      deduplicationState.sourceOfferIds.includes(offer.id)
    ) {
      return true;
    }

    const sameTitle = normalizeComparable(existingOffer.title) === normalizedTitle;
    const sameCompany = normalizeComparable(existingOffer.companyName) === normalizedCompany;
    const sameLocation =
      !normalizedLocation ||
      !normalizeComparable(existingOffer.locationLabel) ||
      normalizeComparable(existingOffer.locationLabel) === normalizedLocation;

    return sameTitle && sameCompany && sameLocation && isPostedWithinTolerance(existingOffer.postedAt, offer.publishedAt);
  });
}

export async function persistSearchDiscoveryResult(
  userId: string,
  result: SearchDiscoveryResult,
): Promise<SearchPersistenceSummary> {
  if (result.offers.length !== result.normalizedOffers.length) {
    throw new SearchPersistenceError(
      "The discovery result cannot be persisted because normalized offers are incomplete",
      500,
    );
  }

  const now = new Date();
  const normalizedByRawSourceId = new Map(
    result.normalizedOffers.map((offer) => [offer.rawSourceId, offer]),
  );

  return db.$transaction(async (tx) => {
    const searchRun = await tx.searchRun.create({
      data: {
        userId,
        label: buildSearchRunLabel(result.generatedAt),
        queryText: buildSearchRunQueryText(result),
        status: SearchRunStatus.COMPLETED,
        filtersSnapshot: {
          generatedAt: result.generatedAt,
          planSummary: result.planSummary,
          providers: result.providers,
          warnings: result.warnings,
          queryExecutions: result.queryExecutions,
        },
        startedAt: new Date(result.generatedAt),
        completedAt: now,
        resultCount: result.offers.length,
      },
      select: {
        id: true,
      },
    });

    const existingOffers = await tx.jobOffer.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        fingerprint: true,
        title: true,
        companyName: true,
        locationLabel: true,
        sourceUrl: true,
        externalId: true,
        postedAt: true,
        rawPayload: true,
      },
    });

    const existingOfferPool = [...existingOffers];
    const linkedMatchesByOfferId = new Map<
      string,
      {
        id: string;
        rank: number;
        rawScore: number | null;
        normalizedScore: number | null;
        matchExplanation: string | null;
      }
    >();

    let createdOfferCount = 0;
    let updatedOfferCount = 0;

    for (const [index, offer] of result.offers.entries()) {
      const normalizedOpportunity = normalizedByRawSourceId.get(offer.id);

      if (!normalizedOpportunity) {
        throw new SearchPersistenceError(
          `Missing normalized opportunity for source offer ${offer.id}`,
          500,
        );
      }

      const duplicateOffer = findDuplicateOffer(
        existingOfferPool,
        offer,
        normalizedOpportunity.fingerprint,
      );
      const deduplicationState = mergeDeduplicationState(
        duplicateOffer ? toDeduplicationState(duplicateOffer.rawPayload) : toDeduplicationState(null),
        {
          fingerprint: normalizedOpportunity.fingerprint,
          offerId: offer.id,
          sourceUrl: offer.sourceUrl,
          provider: normalizedOpportunity.sourceProvider,
        },
      );
      const persistencePayload = {
        offer,
        normalizedOpportunity,
        deduplication: deduplicationState,
      };

      const persistedOffer = duplicateOffer
        ? await tx.jobOffer.update({
            where: {
              id: duplicateOffer.id,
            },
            data: {
              sourceKind: mapOfferSourceKind(offer.sourceKind),
              sourceSite: offer.sourceSite,
              sourceUrl: offer.sourceUrl,
              externalId: offer.id,
              companyName: offer.companyName,
              title: offer.title,
              locationLabel: offer.locationLabel,
              countryCode: offer.countryCode,
              employmentType: mapEmploymentType(offer.contractType),
              workMode: mapWorkMode(offer.remoteMode),
              description:
                normalizedOpportunity.description ?? offer.summary ?? offer.profileSnippet ?? null,
              rawPayload: persistencePayload,
              status: OfferLifecycleStatus.NORMALIZED,
              postedAt: offer.publishedAt ? new Date(offer.publishedAt) : null,
              lastSeenAt: now,
            },
            select: {
              id: true,
            },
          })
        : await tx.jobOffer.create({
            data: {
              userId,
              sourceKind: mapOfferSourceKind(offer.sourceKind),
              sourceSite: offer.sourceSite,
              sourceUrl: offer.sourceUrl,
              externalId: offer.id,
              fingerprint: normalizedOpportunity.fingerprint,
              companyName: offer.companyName,
              title: offer.title,
              locationLabel: offer.locationLabel,
              countryCode: offer.countryCode,
              employmentType: mapEmploymentType(offer.contractType),
              workMode: mapWorkMode(offer.remoteMode),
              description:
                normalizedOpportunity.description ?? offer.summary ?? offer.profileSnippet ?? null,
              rawPayload: persistencePayload,
              status: OfferLifecycleStatus.NORMALIZED,
              postedAt: offer.publishedAt ? new Date(offer.publishedAt) : null,
              firstSeenAt: now,
              lastSeenAt: now,
            },
            select: {
              id: true,
            },
          });

      if (duplicateOffer) {
        updatedOfferCount += 1;
      } else {
        createdOfferCount += 1;
        existingOfferPool.push({
          id: persistedOffer.id,
          fingerprint: normalizedOpportunity.fingerprint,
          title: offer.title,
          companyName: offer.companyName,
          locationLabel: offer.locationLabel,
          sourceUrl: offer.sourceUrl,
          externalId: offer.id,
          postedAt: offer.publishedAt ? new Date(offer.publishedAt) : null,
          rawPayload: persistencePayload,
        });
      }

      const existingMatch = linkedMatchesByOfferId.get(persistedOffer.id);

      if (existingMatch) {
        const nextRank = Math.min(existingMatch.rank, index + 1);
        const nextRawScore = Math.max(existingMatch.rawScore ?? 0, offer.matching.score);
        const nextNormalizedScore = Math.max(
          existingMatch.normalizedScore ?? 0,
          offer.matching.score / 100,
        );
        const nextExplanation = [existingMatch.matchExplanation, buildMatchExplanation(offer)]
          .filter(Boolean)
          .join(" | ");

        await tx.searchRunOffer.update({
          where: {
            id: existingMatch.id,
          },
          data: {
            rank: nextRank,
            rawScore: nextRawScore,
            normalizedScore: nextNormalizedScore,
            matchExplanation: nextExplanation || null,
          },
        });

        linkedMatchesByOfferId.set(persistedOffer.id, {
          id: existingMatch.id,
          rank: nextRank,
          rawScore: nextRawScore,
          normalizedScore: nextNormalizedScore,
          matchExplanation: nextExplanation || null,
        });
        continue;
      }

      const createdMatch = await tx.searchRunOffer.create({
        data: {
          searchRunId: searchRun.id,
          jobOfferId: persistedOffer.id,
          rank: index + 1,
          rawScore: offer.matching.score,
          normalizedScore: offer.matching.score / 100,
          matchExplanation: buildMatchExplanation(offer),
        },
        select: {
          id: true,
        },
      });

      linkedMatchesByOfferId.set(persistedOffer.id, {
        id: createdMatch.id,
        rank: index + 1,
        rawScore: offer.matching.score,
        normalizedScore: offer.matching.score / 100,
        matchExplanation: buildMatchExplanation(offer),
      });
    }

    return {
      searchRunId: searchRun.id,
      persistedOfferCount: result.offers.length,
      createdOfferCount,
      updatedOfferCount,
    };
  });
}
