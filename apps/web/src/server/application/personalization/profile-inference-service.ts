import { Prisma, SearchSignalStrength } from "@prisma/client";

import { db } from "@/lib/db";
import {
  buildDeclaredSearchProfileSnapshotFromFiles,
  defaultSearchPersonalizationGuardrails,
  type InferredSearchPreference,
  type SearchPersonalizationConvergenceMetrics,
  type SearchPersonalizationDiagnostics,
  type SearchPersonalizationImpactMetrics,
  type SearchPersonalizationSnapshot,
  selectEffectiveInferredPreferences,
  type SearchPreferenceAxis,
  type SearchPreferenceConfidence,
  type SearchPreferencePolarity,
  type SearchProfileSignalSource,
} from "@/lib/profile/personalization-model";
import {
  getSearchBehaviorEventLabel,
  searchBehaviorEventTypes,
  type SearchBehaviorEventType,
} from "@/lib/profile/personalization-signals";
import { exportUserConfig } from "@/lib/config/user-config";
import type { SearchDiscoveryOffer } from "@/lib/search/types";
import { matchProfileToOffer } from "@/lib/search/matching";
import { getRequiredActiveWorkspaceIdForUser } from "@/server/application/workspace/workspace-service";

type PersistedSignalRecord = {
  axis?: unknown;
  value?: unknown;
  polarity?: unknown;
  weight?: unknown;
  source?: unknown;
};

type AggregatedPreference = {
  axis: SearchPreferenceAxis;
  value: string;
  polarity: SearchPreferencePolarity;
  score: number;
  sources: Set<SearchProfileSignalSource>;
  supportingEventCount: number;
  lastObservedAt: string | null;
  outcomeHits: number;
  dominantEventTypes: Set<string>;
};

const LOOKBACK_DAYS = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isSearchPreferenceAxis(value: unknown): value is SearchPreferenceAxis {
  return (
    value === "ROLE" ||
    value === "DOMAIN" ||
    value === "KEYWORD" ||
    value === "TECHNOLOGY" ||
    value === "LOCATION" ||
    value === "WORK_MODE" ||
    value === "EMPLOYMENT_TYPE" ||
    value === "COMPANY" ||
    value === "COMPANY_TYPE" ||
    value === "OUTCOME"
  );
}

function isSearchProfileSignalSource(value: unknown): value is SearchProfileSignalSource {
  return (
    value === "ONBOARDING" ||
    value === "PROFILE_EDIT" ||
    value === "PROFILE_ENRICHMENT" ||
    value === "SEARCH_EXECUTED" ||
    value === "SEARCH_QUERY" ||
    value === "SEARCH_PLAN_VIEWED" ||
    value === "SEARCH_RESULT_OPENED" ||
    value === "COMPANY_TARGET_OPENED" ||
    value === "ATS_SOURCE_OPENED" ||
    value === "OFFER_FEEDBACK" ||
    value === "OFFER_DELETED" ||
    value === "OFFER_SHORTLISTED" ||
    value === "DRAFT_GENERATED" ||
    value === "EMAIL_SENT" ||
    value === "EMAIL_REPLY_RECEIVED" ||
    value === "APPLICATION_OUTCOME"
  );
}

function strengthMultiplier(strength: SearchSignalStrength) {
  switch (strength) {
    case SearchSignalStrength.WEAK:
      return 0.6;
    case SearchSignalStrength.MEDIUM:
      return 1;
    case SearchSignalStrength.STRONG:
      return 1.5;
    case SearchSignalStrength.OUTCOME:
      return 2.2;
    default:
      return 1;
  }
}

function recencyMultiplier(occurredAt: Date) {
  const ageInDays = (Date.now() - occurredAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 14) {
    return 1.2;
  }

  if (ageInDays <= 45) {
    return 1;
  }

  if (ageInDays <= 90) {
    return 0.85;
  }

  return 0.65;
}

function isSearchBehaviorEventType(value: string): value is SearchBehaviorEventType {
  return searchBehaviorEventTypes.some((eventType) => eventType === value);
}

function formatEventTypeLabel(value: string) {
  return isSearchBehaviorEventType(value) ? getSearchBehaviorEventLabel(value) : value;
}

function joinHumanList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} et ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")} et ${values[values.length - 1]}`;
}

function hasStrongPreferenceEvidence(preference: AggregatedPreference) {
  return Array.from(preference.sources).some((source) =>
    [
      "OFFER_FEEDBACK",
      "OFFER_SHORTLISTED",
      "OFFER_DELETED",
      "EMAIL_SENT",
      "EMAIL_REPLY_RECEIVED",
      "APPLICATION_OUTCOME",
    ].includes(source),
  );
}

function inferConfidence(preference: AggregatedPreference): SearchPreferenceConfidence {
  const absoluteScore = Math.abs(preference.score);

  if (preference.outcomeHits > 0) {
    return "HIGH";
  }

  if (
    (hasStrongPreferenceEvidence(preference) &&
      absoluteScore >= 6 &&
      preference.supportingEventCount >= 3) ||
    (absoluteScore >= 9 && preference.supportingEventCount >= 5)
  ) {
    return "HIGH";
  }

  if (
    (hasStrongPreferenceEvidence(preference) &&
      (absoluteScore >= 3.5 || preference.supportingEventCount >= 2)) ||
    absoluteScore >= 4 ||
    preference.supportingEventCount >= 3
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function buildPreferenceReason(preference: AggregatedPreference) {
  const eventTypes = Array.from(preference.dominantEventTypes)
    .slice(0, 3)
    .map((eventType) => formatEventTypeLabel(eventType));

  if (eventTypes.length === 0) {
    return null;
  }

  const prefix =
    preference.polarity === "NEGATIVE"
      ? "Cette piste est plutot mise a distance"
      : "Cette piste revient regulierement";
  const outcomeNote =
    preference.outcomeHits > 0
      ? " Un resultat concret renforce aussi cette tendance."
      : "";

  return `${prefix} sur ${preference.supportingEventCount} signal(aux), surtout via ${joinHumanList(eventTypes)}.${outcomeNote}`;
}

function readSignalRecords(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("signals" in value) ||
    !Array.isArray((value as { signals?: unknown[] }).signals)
  ) {
    return [];
  }

  return ((value as { signals: unknown[] }).signals as unknown[])
    .filter((item): item is PersistedSignalRecord => typeof item === "object" && item !== null)
    .map((item) => {
      if (!isSearchPreferenceAxis(item.axis) || typeof item.value !== "string") {
        return null;
      }

      return {
        axis: item.axis,
        value: item.value,
        polarity: item.polarity === "NEGATIVE" ? "NEGATIVE" : "POSITIVE",
        weight: typeof item.weight === "number" ? item.weight : 1,
        source: isSearchProfileSignalSource(item.source) ? item.source : "SEARCH_EXECUTED",
      };
    })
    .filter(Boolean) as Array<{
    axis: SearchPreferenceAxis;
    value: string;
    polarity: SearchPreferencePolarity;
    weight: number;
    source: SearchProfileSignalSource;
  }>;
}

function aggregatePreferences(
  events: Array<{
    type: string;
    strength: SearchSignalStrength;
    occurredAt: Date;
    signalPayload: unknown;
  }>,
) {
  const aggregates = new Map<string, AggregatedPreference>();

  for (const event of events) {
    const signals = readSignalRecords(event.signalPayload);

    for (const signal of signals) {
      const key = `${signal.axis}:${signal.value.toLowerCase()}:${signal.polarity}`;
      const weightedScore =
        signal.weight * strengthMultiplier(event.strength) * recencyMultiplier(event.occurredAt);
      const signedScore = signal.polarity === "NEGATIVE" ? -weightedScore : weightedScore;
      const aggregate = aggregates.get(key);

      if (aggregate) {
        aggregate.score += signedScore;
        aggregate.supportingEventCount += 1;
        aggregate.sources.add(signal.source);
        aggregate.dominantEventTypes.add(event.type);
        aggregate.lastObservedAt =
          !aggregate.lastObservedAt || event.occurredAt.toISOString() > aggregate.lastObservedAt
            ? event.occurredAt.toISOString()
            : aggregate.lastObservedAt;
        if (event.strength === SearchSignalStrength.OUTCOME) {
          aggregate.outcomeHits += 1;
        }
      } else {
        aggregates.set(key, {
          axis: signal.axis,
          value: signal.value,
          polarity: signal.polarity,
          score: signedScore,
          sources: new Set([signal.source]),
          supportingEventCount: 1,
          lastObservedAt: event.occurredAt.toISOString(),
          outcomeHits: event.strength === SearchSignalStrength.OUTCOME ? 1 : 0,
          dominantEventTypes: new Set([event.type]),
        });
      }
    }
  }

  return Array.from(aggregates.values())
    .filter((preference) => Math.abs(preference.score) >= 1.1)
    .sort((left, right) => Math.abs(right.score) - Math.abs(left.score));
}

function toInferredPreference(preference: AggregatedPreference): InferredSearchPreference {
  return {
    axis: preference.axis,
    value: preference.value,
    polarity: preference.polarity,
    score: Math.round(Math.abs(preference.score) * 10) / 10,
    confidence: inferConfidence(preference),
    sources: Array.from(preference.sources),
    supportingEventCount: preference.supportingEventCount,
    lastObservedAt: preference.lastObservedAt,
    reason: buildPreferenceReason(preference),
  };
}

function toDiscoveryOfferFromRawPayload(value: unknown): SearchDiscoveryOffer | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("offer" in value) ||
    typeof (value as { offer?: unknown }).offer !== "object" ||
    (value as { offer?: unknown }).offer === null
  ) {
    return null;
  }

  const offer = (value as { offer: Record<string, unknown> }).offer;

  if (
    typeof offer.id !== "string" ||
    typeof offer.title !== "string" ||
    typeof offer.companyName !== "string" ||
    typeof offer.sourceUrl !== "string"
  ) {
    return null;
  }

  return {
    id: offer.id,
    provider: typeof offer.provider === "string" ? offer.provider : "web",
    sourceKind: offer.sourceKind === "COMPANY_CAREERS" ? "COMPANY_CAREERS" : "JOB_BOARD",
    sourceSite: typeof offer.sourceSite === "string" ? offer.sourceSite : "Web",
    title: offer.title,
    companyName: offer.companyName,
    companySlug: typeof offer.companySlug === "string" ? offer.companySlug : null,
    locationLabel: typeof offer.locationLabel === "string" ? offer.locationLabel : null,
    countryCode: typeof offer.countryCode === "string" ? offer.countryCode : null,
    contractType: typeof offer.contractType === "string" ? offer.contractType : null,
    remoteMode: typeof offer.remoteMode === "string" ? offer.remoteMode : null,
    publishedAt: typeof offer.publishedAt === "string" ? offer.publishedAt : null,
    sourceUrl: offer.sourceUrl,
    summary: typeof offer.summary === "string" ? offer.summary : null,
    profileSnippet: typeof offer.profileSnippet === "string" ? offer.profileSnippet : null,
    matchedQueryIds: Array.isArray(offer.matchedQueryIds)
      ? offer.matchedQueryIds.filter((item): item is string => typeof item === "string")
      : [],
    matchedQueryLabels: Array.isArray(offer.matchedQueryLabels)
      ? offer.matchedQueryLabels.filter((item): item is string => typeof item === "string")
      : [],
    matchedKeywords: Array.isArray(offer.matchedKeywords)
      ? offer.matchedKeywords.filter((item): item is string => typeof item === "string")
      : [],
    priorityScore: typeof offer.priorityScore === "number" ? offer.priorityScore : 50,
    relevanceScore: typeof offer.relevanceScore === "number" ? offer.relevanceScore : 50,
    relevanceLabel:
      offer.relevanceLabel === "Tres forte" ||
      offer.relevanceLabel === "Forte" ||
      offer.relevanceLabel === "Intermediaire"
        ? offer.relevanceLabel
        : "Exploratoire",
    matching:
      typeof offer.matching === "object" && offer.matching !== null
        ? {
            score:
              typeof (offer.matching as { score?: unknown }).score === "number"
                ? ((offer.matching as { score: number }).score as number)
                : 20,
            label:
              (offer.matching as { label?: SearchDiscoveryOffer["matching"]["label"] }).label ??
              "Exploratoire",
            summary:
              typeof (offer.matching as { summary?: unknown }).summary === "string"
                ? ((offer.matching as { summary: string }).summary as string)
                : "Match non calcule.",
            breakdown: Array.isArray((offer.matching as { breakdown?: unknown[] }).breakdown)
              ? ((offer.matching as { breakdown: SearchDiscoveryOffer["matching"]["breakdown"] }).breakdown as SearchDiscoveryOffer["matching"]["breakdown"])
              : [],
          }
        : {
            score: 20,
            label: "Exploratoire",
            summary: "Match non calcule.",
            breakdown: [],
          },
  };
}

function buildImpactMetrics(
  offers: Array<{
    id: string;
    title: string;
    companyName: string;
    rawPayload: unknown;
  }>,
  config: Awaited<ReturnType<typeof exportUserConfig>>,
  inferred: InferredSearchPreference[],
): SearchPersonalizationImpactMetrics {
  const effectivePreferences = selectEffectiveInferredPreferences(inferred);
  const comparisons = offers
    .map((offer) => {
      const discoveryOffer = toDiscoveryOfferFromRawPayload(offer.rawPayload);

      if (!discoveryOffer) {
        return null;
      }

      const explicitScore = matchProfileToOffer(
        {
          personalProfile: config.personalProfile,
          searchTargets: config.searchTargets,
        },
        discoveryOffer,
      ).score;
      const personalizedScore = matchProfileToOffer(
        {
          personalProfile: config.personalProfile,
          searchTargets: config.searchTargets,
          inferredPreferences: effectivePreferences,
        },
        discoveryOffer,
      ).score;

      return {
        offerId: offer.id,
        title: offer.title,
        companyName: offer.companyName,
        explicitScore,
        personalizedScore,
        delta: personalizedScore - explicitScore,
      };
    })
    .filter(Boolean) as Array<{
    offerId: string;
    title: string;
    companyName: string;
    explicitScore: number;
    personalizedScore: number;
    delta: number;
  }>;

  const personalizedWins = comparisons.filter((item) => item.delta >= 3).length;
  const explicitWins = comparisons.filter((item) => item.delta <= -3).length;
  const unchangedCount = comparisons.length - personalizedWins - explicitWins;
  const averageScoreDelta =
    comparisons.length > 0
      ? Math.round(
          (comparisons.reduce((total, item) => total + item.delta, 0) / comparisons.length) * 10,
        ) / 10
      : 0;

  return {
    comparedOfferCount: comparisons.length,
    personalizedWins,
    unchangedCount,
    explicitWins,
    averageScoreDelta,
    topBoostedOffers: comparisons
      .filter((item) => item.delta > 0)
      .sort((left, right) => right.delta - left.delta)
      .slice(0, 5),
  };
}

function summarizeImplicitSignals(
  events: Array<{
    type: string;
    signalPayload: unknown;
    metadata: unknown;
  }>,
) {
  let positiveImplicitSignalCount = 0;
  let dwellQualifiedOpenCount = 0;
  let companyExplorationCount = 0;

  for (const event of events) {
    const signals = readSignalRecords(event.signalPayload).filter(
      (signal) => signal.polarity === "POSITIVE",
    );

    positiveImplicitSignalCount += signals.length;

    // We treat an expanded result with >= 7 seconds of dwell as a "real read",
    // not just a navigation click. This keeps the UI metric tied to attention.
    if (
      event.type === "SEARCH_RESULT_EXPANDED" &&
      typeof event.metadata === "object" &&
      event.metadata !== null &&
      typeof (event.metadata as { dwellMs?: unknown }).dwellMs === "number" &&
      ((event.metadata as { dwellMs: number }).dwellMs as number) >= 7000
    ) {
      dwellQualifiedOpenCount += 1;
    }

    if (event.type === "COMPANY_TARGET_OPENED" || event.type === "ATS_SOURCE_OPENED") {
      companyExplorationCount += 1;
    }
  }

  return {
    engagementEventCount: events.length,
    dwellQualifiedOpenCount,
    companyExplorationCount,
    positiveImplicitSignalCount,
  };
}

function buildConvergenceMetrics(
  runs: Array<{
    id: string;
    label: string;
    createdAt: Date;
    resultCount: number;
    searchMatches: Array<{
      rawScore: number | null;
      rank: number | null;
    }>;
  }>,
): SearchPersonalizationConvergenceMetrics {
  const recentRuns = runs
    .slice()
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((run) => {
      const scoredMatches = run.searchMatches
        .filter((match): match is { rawScore: number; rank: number | null } => typeof match.rawScore === "number")
        .sort((left, right) => {
          const leftRank = left.rank ?? Number.MAX_SAFE_INTEGER;
          const rightRank = right.rank ?? Number.MAX_SAFE_INTEGER;

          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }

          return right.rawScore - left.rawScore;
        });
      const topMatches = scoredMatches.slice(0, 5);
      const averageTopScore =
        topMatches.length > 0
          ? Math.round(
              (topMatches.reduce((total, match) => total + match.rawScore, 0) /
                topMatches.length) *
                10,
            ) / 10
          : null;
      const relevantShare =
        scoredMatches.length > 0
          ? Math.round(
              (scoredMatches.filter((match) => match.rawScore >= 68).length /
                scoredMatches.length) *
                100,
            ) / 100
          : null;

      return {
        runId: run.id,
        label: run.label,
        createdAt: run.createdAt.toISOString(),
        averageTopScore,
        relevantShare,
        resultCount: run.resultCount,
      };
    });

  const firstComparable = recentRuns.find((run) => run.averageTopScore !== null) ?? null;
  const latestComparable =
    recentRuns
      .slice()
      .reverse()
      .find((run) => run.averageTopScore !== null) ?? null;
  // This delta tracks whether the top of the result list improves over time.
  // We compare the average raw score of the best 5 offers in the first and latest comparable runs.
  const averageTopScoreDelta =
    firstComparable && latestComparable
      ? Math.round((latestComparable.averageTopScore! - firstComparable.averageTopScore!) * 10) /
        10
      : 0;
  const relevantShareDelta =
    firstComparable?.relevantShare !== null &&
    firstComparable?.relevantShare !== undefined &&
    latestComparable?.relevantShare !== null &&
    latestComparable?.relevantShare !== undefined
      ? Math.round((latestComparable.relevantShare - firstComparable.relevantShare) * 100) / 100
      : null;

  return {
    evaluatedRunCount: recentRuns.length,
    firstRunAverageTopScore: firstComparable?.averageTopScore ?? null,
    latestRunAverageTopScore: latestComparable?.averageTopScore ?? null,
    averageTopScoreDelta,
    firstRelevantShare: firstComparable?.relevantShare ?? null,
    latestRelevantShare: latestComparable?.relevantShare ?? null,
    relevantShareDelta,
    recentRuns,
  };
}

export async function refreshUserSearchProfileInference(userId: string, workspaceId?: string) {
  const resolvedWorkspaceId =
    workspaceId ?? (await getRequiredActiveWorkspaceIdForUser(userId));
  const [config, enrichment, events, offers, recentRuns] = await Promise.all([
    exportUserConfig({
      userId,
      workspaceId: resolvedWorkspaceId,
    }),
    db.userProfileEnrichment.findUnique({
      where: {
        userId,
      },
      select: {
        extractedData: true,
      },
    }),
    db.searchBehaviorEvent.findMany({
      where: {
        userId,
        occurredAt: {
          gte: new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        occurredAt: "desc",
      },
      select: {
        type: true,
        strength: true,
        occurredAt: true,
        signalPayload: true,
        metadata: true,
      },
    }),
    db.jobOffer.findMany({
      where: {
        userId,
        workspaceId: resolvedWorkspaceId,
      },
      orderBy: {
        lastSeenAt: "desc",
      },
      take: 30,
      select: {
        id: true,
        title: true,
        companyName: true,
        rawPayload: true,
      },
    }),
    db.searchRun.findMany({
      where: {
        userId,
        workspaceId: resolvedWorkspaceId,
        status: {
          in: ["COMPLETED", "PARTIAL"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        label: true,
        createdAt: true,
        resultCount: true,
        searchMatches: {
          select: {
            rawScore: true,
            rank: true,
          },
        },
      },
    }),
  ]);

  const declared = buildDeclaredSearchProfileSnapshotFromFiles(
    config.personalProfile,
    config.searchTargets,
    {
      enrichmentData: enrichment?.extractedData,
    },
  );
  const aggregated = aggregatePreferences(events);
  const inferred = aggregated
    .map((preference) => toInferredPreference(preference))
    .sort((left, right) => right.score - left.score)
    .slice(0, 40);
  const effectiveInferredPreferences = selectEffectiveInferredPreferences(
    inferred,
    defaultSearchPersonalizationGuardrails,
  );
  const impact = buildImpactMetrics(offers, config, inferred);
  const implicitSignalSummary = summarizeImplicitSignals(events);
  const convergence = buildConvergenceMetrics(recentRuns);
  const diagnostics: SearchPersonalizationDiagnostics = {
    eventCount: events.length,
    lastEventAt: events[0]?.occurredAt.toISOString() ?? null,
    eventTypeCounts: events.reduce<Record<string, number>>((counts, event) => {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
      return counts;
    }, {}),
    effectiveInferredPreferences,
    guardrailSummary: defaultSearchPersonalizationGuardrails.map((guardrail) => ({
      axis: guardrail.axis,
      mode: guardrail.mode,
    })),
    impact,
    implicitSignalSummary,
    convergence,
  };
  const snapshot: SearchPersonalizationSnapshot = {
    declared,
    inferred,
    guardrails: defaultSearchPersonalizationGuardrails,
  };

  return db.userSearchProfileInference.upsert({
    where: {
      userId,
    },
    update: {
      workspaceId: resolvedWorkspaceId,
      declaredSnapshot: declared as Prisma.InputJsonValue,
      inferredSnapshot: snapshot as Prisma.InputJsonValue,
      diagnostics: diagnostics as Prisma.InputJsonValue,
      eventCount: events.length,
      lastEventAt: events[0]?.occurredAt ?? null,
      lastComputedAt: new Date(),
    },
    create: {
      userId,
      workspaceId: resolvedWorkspaceId,
      declaredSnapshot: declared as Prisma.InputJsonValue,
      inferredSnapshot: snapshot as Prisma.InputJsonValue,
      diagnostics: diagnostics as Prisma.InputJsonValue,
      eventCount: events.length,
      lastEventAt: events[0]?.occurredAt ?? null,
      lastComputedAt: new Date(),
    },
  });
}

function readSnapshot<T>(value: unknown) {
  return (value ?? null) as T | null;
}

export async function getSearchPersonalizationSnapshot(userId: string, workspaceId?: string) {
  const resolvedWorkspaceId =
    workspaceId ?? (await getRequiredActiveWorkspaceIdForUser(userId));
  const snapshot = await db.userSearchProfileInference.findUnique({
    where: {
      userId,
    },
    select: {
      inferredSnapshot: true,
      diagnostics: true,
      lastComputedAt: true,
      eventCount: true,
    },
  });

  if (!snapshot || !snapshot.inferredSnapshot) {
    const refreshed = await refreshUserSearchProfileInference(userId, resolvedWorkspaceId);

    return {
      snapshot: readSnapshot<SearchPersonalizationSnapshot>(refreshed.inferredSnapshot),
      diagnostics: readSnapshot<SearchPersonalizationDiagnostics>(refreshed.diagnostics),
      lastComputedAt: refreshed.lastComputedAt?.toISOString() ?? null,
      eventCount: refreshed.eventCount,
    };
  }

  return {
    snapshot: readSnapshot<SearchPersonalizationSnapshot>(snapshot.inferredSnapshot),
    diagnostics: readSnapshot<SearchPersonalizationDiagnostics>(snapshot.diagnostics),
    lastComputedAt: snapshot.lastComputedAt?.toISOString() ?? null,
    eventCount: snapshot.eventCount,
  };
}

export async function getEffectiveInferredPreferences(userId: string, workspaceId?: string) {
  const personalization = await getSearchPersonalizationSnapshot(userId, workspaceId);

  return selectEffectiveInferredPreferences(personalization.snapshot?.inferred ?? []);
}
