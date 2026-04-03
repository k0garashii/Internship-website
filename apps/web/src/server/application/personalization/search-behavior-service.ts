import { Prisma, SearchBehaviorEventType } from "@prisma/client";

import type { AuthenticatedViewer } from "@/lib/auth/viewer";
import { assertAuthenticatedViewer } from "@/lib/auth/viewer";
import {
  type InferredSearchPreference,
  normalizePersonalizationValue,
  type SearchPreferenceAxis,
  type SearchPreferencePolarity,
  type SearchProfileSignalSource,
} from "@/lib/profile/personalization-model";
import { getSearchBehaviorEventDefinition } from "@/lib/profile/personalization-signals";
import type { SearchQueryPlan, SearchQueryCandidate } from "@/lib/search/query-plan";
import type {
  SearchDiscoveryOffer,
  SearchDiscoveryQueryExecution,
} from "@/lib/search/types";
import { db } from "@/lib/db";
import { logServiceError } from "@/lib/observability/error-logging";
import { getRequiredActiveWorkspaceIdForUser } from "@/server/application/workspace/workspace-service";
import { refreshUserSearchProfileInference } from "@/server/application/personalization/profile-inference-service";

export type SearchBehaviorSignal = {
  axis: SearchPreferenceAxis;
  value: string;
  polarity?: SearchPreferencePolarity;
  weight?: number;
  source?: SearchProfileSignalSource;
};

type RecordSearchBehaviorEventInput = {
  type: SearchBehaviorEventType;
  signals: SearchBehaviorSignal[];
  occurredAt?: Date;
  dedupeKey?: string | null;
  queryText?: string | null;
  companyName?: string | null;
  companySlug?: string | null;
  sourceUrl?: string | null;
  jobOfferId?: string | null;
  searchRunId?: string | null;
  emailDraftId?: string | null;
  mailboxMessageId?: string | null;
  metadata?: Prisma.JsonObject | null;
  refreshInference?: boolean;
};

function uniqueByKey<T>(values: T[], getKey: (value: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = getKey(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function toSignalSource(type: SearchBehaviorEventType): SearchProfileSignalSource {
  switch (type) {
    case SearchBehaviorEventType.SEARCH_PLAN_VIEWED:
      return "SEARCH_PLAN_VIEWED";
    case SearchBehaviorEventType.SEARCH_EXECUTED:
      return "SEARCH_EXECUTED";
    case SearchBehaviorEventType.SEARCH_RESULT_OPENED:
    case SearchBehaviorEventType.SEARCH_RESULT_EXPANDED:
      return "SEARCH_RESULT_OPENED";
    case SearchBehaviorEventType.COMPANY_TARGET_OPENED:
      return "COMPANY_TARGET_OPENED";
    case SearchBehaviorEventType.ATS_SOURCE_OPENED:
      return "ATS_SOURCE_OPENED";
    case SearchBehaviorEventType.OFFER_DELETED:
      return "OFFER_DELETED";
    case SearchBehaviorEventType.OFFER_FEEDBACK_FAVORITE:
    case SearchBehaviorEventType.OFFER_FEEDBACK_MAYBE:
    case SearchBehaviorEventType.OFFER_FEEDBACK_NOT_RELEVANT:
      return "OFFER_FEEDBACK";
    case SearchBehaviorEventType.OFFER_SAVED:
      return "OFFER_SHORTLISTED";
    case SearchBehaviorEventType.DRAFT_GENERATED:
      return "DRAFT_GENERATED";
    case SearchBehaviorEventType.EMAIL_SENT:
      return "EMAIL_SENT";
    case SearchBehaviorEventType.EMAIL_REPLY_RECEIVED:
    case SearchBehaviorEventType.INTERVIEW_RECORDED:
    case SearchBehaviorEventType.REJECTION_RECORDED:
    case SearchBehaviorEventType.OFFER_ACCEPTED_RECORDED:
      return "APPLICATION_OUTCOME";
    default:
      return "SEARCH_EXECUTED";
  }
}

function normalizeSignal(
  type: SearchBehaviorEventType,
  signal: SearchBehaviorSignal,
): {
  axis: SearchPreferenceAxis;
  value: string;
  polarity: SearchPreferencePolarity;
  weight: number;
  source: SearchProfileSignalSource;
} | null {
  const normalizedValue = normalizePersonalizationValue(signal.value);

  if (!normalizedValue) {
    return null;
  }

  return {
    axis: signal.axis,
    value: normalizedValue,
    polarity: signal.polarity ?? "POSITIVE",
    weight: signal.weight ?? 1,
    source: signal.source ?? toSignalSource(type),
  };
}

function buildAxisSummary(signals: Array<{ axis: SearchPreferenceAxis }>) {
  return Array.from(new Set(signals.map((signal) => signal.axis)));
}

export function buildSignalsFromSearchPlan(plan: SearchQueryPlan): SearchBehaviorSignal[] {
  return uniqueByKey(
    [
      ...plan.inputs.targetRoles.map((value) => ({ axis: "ROLE" as const, value, weight: 1 })),
      ...plan.inputs.domains.map((value) => ({ axis: "DOMAIN" as const, value, weight: 1 })),
      ...plan.inputs.locations.map((value) => ({ axis: "LOCATION" as const, value, weight: 1 })),
      ...plan.inputs.keywords.map((value) => ({ axis: "KEYWORD" as const, value, weight: 0.8 })),
    ],
    (item) => `${item.axis}:${item.value.toLowerCase()}`,
  );
}

function buildSignalsFromSearchQuery(query: SearchQueryCandidate | SearchDiscoveryQueryExecution) {
  return uniqueByKey(
    [
      { axis: "ROLE" as const, value: query.targetRole, weight: 1.2 },
      query.domain ? { axis: "DOMAIN" as const, value: query.domain, weight: 1.1 } : null,
      query.location ? { axis: "LOCATION" as const, value: query.location, weight: 1 } : null,
      ...query.focusKeywords.map((value) => ({ axis: "KEYWORD" as const, value, weight: 0.9 })),
    ].filter(Boolean) as SearchBehaviorSignal[],
    (item) => `${item.axis}:${item.value.toLowerCase()}`,
  );
}

export function buildSignalsFromQueryExecutions(executions: SearchDiscoveryQueryExecution[]) {
  return uniqueByKey(
    executions.flatMap((execution) => buildSignalsFromSearchQuery(execution)),
    (item) => `${item.axis}:${item.value.toLowerCase()}`,
  );
}

export function buildSignalsFromDiscoveryOffer(offer: SearchDiscoveryOffer): SearchBehaviorSignal[] {
  const querySignals = offer.matchedQueryLabels.flatMap((label) => {
    const [role, domain] = label.split(" - ").map((item) => item.trim());

    return [
      role ? ({ axis: "ROLE" as const, value: role, weight: 1.1 }) : null,
      domain ? ({ axis: "DOMAIN" as const, value: domain, weight: 0.9 }) : null,
    ].filter(Boolean) as SearchBehaviorSignal[];
  });

  return uniqueByKey(
    [
      { axis: "COMPANY" as const, value: offer.companyName, weight: 1.1 },
      offer.locationLabel
        ? ({ axis: "LOCATION" as const, value: offer.locationLabel, weight: 0.8 } as const)
        : null,
      offer.contractType
        ? ({ axis: "EMPLOYMENT_TYPE" as const, value: offer.contractType, weight: 0.8 } as const)
        : null,
      offer.remoteMode
        ? ({ axis: "WORK_MODE" as const, value: offer.remoteMode, weight: 0.7 } as const)
        : null,
      ...offer.matchedKeywords.map((value) => ({
        axis: "KEYWORD" as const,
        value,
        weight: 0.9,
      })),
      ...querySignals,
    ].filter(Boolean) as SearchBehaviorSignal[],
    (item) => `${item.axis}:${item.value.toLowerCase()}`,
  );
}

export function buildSignalsFromOfferRecord(offer: {
  title: string;
  companyName: string;
  locationLabel?: string | null;
  employmentType?: string | null;
  workMode?: string | null;
  sourceUrl?: string | null;
  rawPayload?: unknown;
}): SearchBehaviorSignal[] {
  const matchedQueryLabels =
    offer.rawPayload &&
    typeof offer.rawPayload === "object" &&
    "offer" in offer.rawPayload &&
    typeof (offer.rawPayload as { offer?: unknown }).offer === "object" &&
    (offer.rawPayload as { offer: { matchedQueryLabels?: unknown } }).offer.matchedQueryLabels &&
    Array.isArray((offer.rawPayload as { offer: { matchedQueryLabels?: unknown[] } }).offer.matchedQueryLabels)
      ? ((offer.rawPayload as { offer: { matchedQueryLabels: unknown[] } }).offer.matchedQueryLabels as unknown[])
          .filter((item): item is string => typeof item === "string")
      : [];
  const matchedKeywords =
    offer.rawPayload &&
    typeof offer.rawPayload === "object" &&
    "offer" in offer.rawPayload &&
    typeof (offer.rawPayload as { offer?: unknown }).offer === "object" &&
    (offer.rawPayload as { offer: { matchedKeywords?: unknown } }).offer.matchedKeywords &&
    Array.isArray((offer.rawPayload as { offer: { matchedKeywords?: unknown[] } }).offer.matchedKeywords)
      ? ((offer.rawPayload as { offer: { matchedKeywords: unknown[] } }).offer.matchedKeywords as unknown[])
          .filter((item): item is string => typeof item === "string")
      : [];

  const querySignals = matchedQueryLabels.flatMap((label) => {
    const [role, domain] = label.split(" - ").map((item) => item.trim());

    return [
      role ? ({ axis: "ROLE" as const, value: role, weight: 1.1 }) : null,
      domain ? ({ axis: "DOMAIN" as const, value: domain, weight: 0.9 }) : null,
    ].filter(Boolean) as SearchBehaviorSignal[];
  });

  return uniqueByKey(
    [
      { axis: "COMPANY" as const, value: offer.companyName, weight: 1.1 },
      offer.locationLabel
        ? ({ axis: "LOCATION" as const, value: offer.locationLabel, weight: 0.8 } as const)
        : null,
      offer.employmentType
        ? ({ axis: "EMPLOYMENT_TYPE" as const, value: offer.employmentType, weight: 0.8 } as const)
        : null,
      offer.workMode
        ? ({ axis: "WORK_MODE" as const, value: offer.workMode, weight: 0.7 } as const)
        : null,
      ...matchedKeywords.map((value) => ({
        axis: "KEYWORD" as const,
        value,
        weight: 0.9,
      })),
      ...querySignals,
    ].filter(Boolean) as SearchBehaviorSignal[],
    (item) => `${item.axis}:${item.value.toLowerCase()}`,
  );
}

export function buildSignalsFromCompanyTarget(input: {
  companyName: string;
  companySlug?: string | null;
  matchedSignals?: string[];
  tags?: string[];
  atsProvider?: string | null;
}) {
  return uniqueByKey(
    [
      { axis: "COMPANY" as const, value: input.companyName, weight: 1.1 },
      ...(input.matchedSignals ?? []).map((value) => ({
        axis: "DOMAIN" as const,
        value,
        weight: 0.9,
      })),
      ...(input.tags ?? []).map((value) => ({
        axis: "COMPANY_TYPE" as const,
        value,
        weight: 0.7,
      })),
      input.atsProvider
        ? ({ axis: "COMPANY_TYPE" as const, value: input.atsProvider, weight: 0.5 } as const)
        : null,
    ].filter(Boolean) as SearchBehaviorSignal[],
    (item) => `${item.axis}:${item.value.toLowerCase()}`,
  );
}

export async function recordSearchBehaviorEvent(
  viewer: Pick<AuthenticatedViewer, "userId" | "workspaceId">,
  input: RecordSearchBehaviorEventInput,
) {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);
  const workspaceId =
    authenticatedViewer.workspaceId ??
    (await getRequiredActiveWorkspaceIdForUser(authenticatedViewer.userId));
  const definition = getSearchBehaviorEventDefinition(input.type);
  const normalizedSignals = uniqueByKey(
    input.signals
      .map((signal) => normalizeSignal(input.type, signal))
      .filter(Boolean) as Array<{
      axis: SearchPreferenceAxis;
      value: string;
      polarity: SearchPreferencePolarity;
      weight: number;
      source: SearchProfileSignalSource;
    }>,
    (item) => `${item.axis}:${item.value.toLowerCase()}:${item.polarity}`,
  );

  const payload = {
    category: definition.category,
    description: definition.description,
    signals: normalizedSignals,
  } as Prisma.JsonObject;
  const metadata =
    input.metadata === null
      ? Prisma.JsonNull
      : ((input.metadata ?? undefined) as Prisma.InputJsonValue | undefined);

  try {
    if (input.dedupeKey) {
      await db.searchBehaviorEvent.upsert({
        where: {
          dedupeKey: input.dedupeKey,
        },
        update: {
          workspaceId,
          type: input.type,
          axisSummary: buildAxisSummary(normalizedSignals),
          strength: definition.strength,
          queryText: input.queryText ?? null,
          companyName: input.companyName ?? null,
          companySlug: input.companySlug ?? null,
          sourceUrl: input.sourceUrl ?? null,
          jobOfferId: input.jobOfferId ?? null,
          searchRunId: input.searchRunId ?? null,
          emailDraftId: input.emailDraftId ?? null,
          mailboxMessageId: input.mailboxMessageId ?? null,
          signalPayload: payload,
          metadata,
          occurredAt: input.occurredAt ?? new Date(),
        },
        create: {
          userId: authenticatedViewer.userId,
          workspaceId,
          type: input.type,
          axisSummary: buildAxisSummary(normalizedSignals),
          strength: definition.strength,
          dedupeKey: input.dedupeKey,
          queryText: input.queryText ?? null,
          companyName: input.companyName ?? null,
          companySlug: input.companySlug ?? null,
          sourceUrl: input.sourceUrl ?? null,
          jobOfferId: input.jobOfferId ?? null,
          searchRunId: input.searchRunId ?? null,
          emailDraftId: input.emailDraftId ?? null,
          mailboxMessageId: input.mailboxMessageId ?? null,
          signalPayload: payload,
          metadata,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
    } else {
      await db.searchBehaviorEvent.create({
        data: {
          userId: authenticatedViewer.userId,
          workspaceId,
          type: input.type,
          axisSummary: buildAxisSummary(normalizedSignals),
          strength: definition.strength,
          queryText: input.queryText ?? null,
          companyName: input.companyName ?? null,
          companySlug: input.companySlug ?? null,
          sourceUrl: input.sourceUrl ?? null,
          jobOfferId: input.jobOfferId ?? null,
          searchRunId: input.searchRunId ?? null,
          emailDraftId: input.emailDraftId ?? null,
          mailboxMessageId: input.mailboxMessageId ?? null,
          signalPayload: payload,
          metadata,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
    }

    if (input.refreshInference !== false) {
      await refreshUserSearchProfileInference(authenticatedViewer.userId, workspaceId);
    }
  } catch (error) {
    logServiceError({
      scope: "personalization/behavior-events",
      message: "Unable to persist search behavior event",
      error,
      metadata: {
        userId: authenticatedViewer.userId,
        workspaceId,
        type: input.type,
      },
    });
    return null;
  }
}
