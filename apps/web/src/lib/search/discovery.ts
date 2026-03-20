import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
import { matchProfileToOffer } from "@/lib/search/matching";
import { normalizeDiscoveryOffers } from "@/lib/search/normalization";
import {
  buildWttjSearchContext,
  formatWttjLocation,
  mapWttjHitUrl,
  matchQueryKeywords,
  searchWttjOffers,
} from "@/lib/search/providers/wttj";
import { buildSearchQueryPlan } from "@/lib/search/query-plan";
import type { SearchQueryCandidate } from "@/lib/search/query-plan";
import { scoreDiscoveryOffer } from "@/lib/search/scoring";
import type {
  SearchDiscoveryOffer,
  SearchDiscoveryQueryExecution,
  SearchDiscoveryResult,
} from "@/lib/search/types";

export class SearchDiscoveryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SearchDiscoveryError";
  }
}

type DiscoveryConfig = {
  personalProfile: PersonalProfileFile;
  searchTargets: SearchTargetsFile;
};

type DiscoveryOptions = {
  queryLimit?: number;
  hitsPerQuery?: number;
  maxOffers?: number;
};

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mergeOffer(
  current: SearchDiscoveryOffer | undefined,
  incoming: SearchDiscoveryOffer,
): SearchDiscoveryOffer {
  if (!current) {
    return incoming;
  }

  return {
    ...current,
    summary: current.summary ?? incoming.summary,
    profileSnippet: current.profileSnippet ?? incoming.profileSnippet,
    matchedQueryIds: Array.from(new Set([...current.matchedQueryIds, ...incoming.matchedQueryIds])),
    matchedQueryLabels: Array.from(
      new Set([...current.matchedQueryLabels, ...incoming.matchedQueryLabels]),
    ),
    matchedKeywords: Array.from(new Set([...current.matchedKeywords, ...incoming.matchedKeywords])),
    priorityScore: Math.max(current.priorityScore, incoming.priorityScore),
    relevanceScore: current.relevanceScore,
    relevanceLabel: current.relevanceLabel,
    matching: current.matching,
  };
}

function compareOffers(left: SearchDiscoveryOffer, right: SearchDiscoveryOffer) {
  const matchingDelta = right.matching.score - left.matching.score;

  if (matchingDelta !== 0) {
    return matchingDelta;
  }

  const priorityDelta = right.priorityScore - left.priorityScore;

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const scoreDelta = right.relevanceScore - left.relevanceScore;

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const leftPublishedAt = left.publishedAt ? Date.parse(left.publishedAt) : 0;
  const rightPublishedAt = right.publishedAt ? Date.parse(right.publishedAt) : 0;

  return rightPublishedAt - leftPublishedAt;
}

function createDiscoveryOffer(
  query: SearchQueryCandidate,
  language: "fr" | "en",
  hit: Awaited<ReturnType<typeof searchWttjOffers>>["hits"][number],
): SearchDiscoveryOffer {
  const location = formatWttjLocation(hit);
  const seedOffer = {
    contractType: hit.contract_type,
    matchedKeywords: matchQueryKeywords(query, hit),
    matchedQueryIds: [query.id],
    profileSnippet: hit.profile,
    publishedAt: hit.published_at,
    summary: hit.summary,
  };
  const scoring = scoreDiscoveryOffer(seedOffer);

  return {
    id: `wttj:${hit.reference ?? hit.objectID}`,
    provider: "wttj",
    sourceKind: "JOB_BOARD",
    sourceSite: "Welcome to the Jungle",
    title: hit.name,
    companyName: hit.organization.name,
    companySlug: hit.organization.slug,
    locationLabel: location.locationLabel,
    countryCode: location.countryCode,
    contractType: hit.contract_type,
    remoteMode: hit.remote,
    publishedAt: hit.published_at,
    sourceUrl: mapWttjHitUrl(hit, language),
    summary: hit.summary,
    profileSnippet: hit.profile,
    matchedQueryIds: [query.id],
    matchedQueryLabels: [query.label],
    matchedKeywords: seedOffer.matchedKeywords,
    priorityScore: query.priority,
    relevanceScore: scoring.score,
    relevanceLabel: scoring.label,
    matching: {
      score: 18,
      label: "Exploratoire",
      summary: "Match non calcule.",
      breakdown: [],
    },
  };
}

function buildQueryFallbacks(query: SearchQueryCandidate) {
  return uniqueList([
    query.queryText,
    [query.targetRole, query.domain].filter(Boolean).join(" "),
    query.targetRole,
  ]);
}

async function searchQueryWithFallback(
  query: SearchQueryCandidate,
  context: ReturnType<typeof buildWttjSearchContext>,
  hitsPerQuery: number,
) {
  const attempts = buildQueryFallbacks(query);
  let lastResult: Awaited<ReturnType<typeof searchWttjOffers>> | null = null;

  for (const queryText of attempts) {
    const result = await searchWttjOffers(
      {
        ...query,
        queryText,
      },
      context,
      { hitsPerPage: hitsPerQuery },
    );

    lastResult = result;

    if (result.hits.length > 0) {
      return {
        executedQueryText: queryText,
        result,
      };
    }
  }

  return {
    executedQueryText: attempts.at(-1) ?? query.queryText,
    result: lastResult ?? (await searchWttjOffers(query, context, { hitsPerPage: hitsPerQuery })),
  };
}

export async function discoverInitialOffers(
  config: DiscoveryConfig,
  options: DiscoveryOptions = {},
): Promise<SearchDiscoveryResult> {
  const plan = buildSearchQueryPlan(config.personalProfile, config.searchTargets);

  if (plan.queries.length === 0) {
    throw new SearchDiscoveryError(
      "No search queries could be generated from the current profile",
      422,
    );
  }

  const queryLimit = clamp(options.queryLimit ?? 6, 1, plan.queries.length);
  const hitsPerQuery = clamp(options.hitsPerQuery ?? 4, 1, 8);
  const maxOffers = clamp(options.maxOffers ?? 18, 1, 30);
  const selectedQueries = plan.queries.slice(0, queryLimit);
  const context = buildWttjSearchContext(config.personalProfile, config.searchTargets);
  const executions: SearchDiscoveryQueryExecution[] = [];
  const warnings: string[] = [];
  const offerMap = new Map<string, SearchDiscoveryOffer>();

  const settledResults = await Promise.allSettled(
    selectedQueries.map((query) => searchQueryWithFallback(query, context, hitsPerQuery)),
  );

  settledResults.forEach((result, index) => {
    const query = selectedQueries[index];

    if (result.status === "rejected") {
      warnings.push(`La requete "${query.label}" a echoue sur Welcome to the Jungle.`);
      return;
    }

    executions.push({
      id: query.id,
      label: query.label,
      targetRole: query.targetRole,
      domain: query.domain,
      location: query.location,
      focusKeywords: query.focusKeywords,
      queryText: result.value.executedQueryText,
      requestedQueryText: query.queryText,
      provider: "wttj",
      providerLabel: "Welcome to the Jungle",
      language: result.value.result.language,
      filters: result.value.result.filters,
      totalHits: result.value.result.totalHits,
      returnedHits: result.value.result.hits.length,
    });

    result.value.result.hits.forEach((hit) => {
      const incoming = createDiscoveryOffer(query, result.value.result.language, hit);
      offerMap.set(incoming.id, mergeOffer(offerMap.get(incoming.id), incoming));
    });
  });

  if (executions.length === 0) {
    throw new SearchDiscoveryError(
      "Unable to search offers from the current public source",
      502,
    );
  }

  const scoredOffers = Array.from(offerMap.values()).map((offer) => {
    const scoring = scoreDiscoveryOffer(offer);
    const matching = matchProfileToOffer(config, offer);

    return {
      ...offer,
      relevanceScore: scoring.score,
      relevanceLabel: scoring.label,
      matching,
    };
  });
  const generatedAt = new Date().toISOString();
  const rankedOffers = scoredOffers.sort(compareOffers).slice(0, maxOffers);

  return {
    generatedAt,
    summary: `Recherche initiale executee sur ${executions.length} requete(s) Welcome to the Jungle pour ${rankedOffers.length} offre(s) dedupliquee(s), puis classee(s) par match et priorite utilisateur.`,
    planSummary: plan.summary,
    queryCount: plan.queries.length,
    executedQueryCount: executions.length,
    offerCount: rankedOffers.length,
    providers: [
      {
        id: "wttj",
        label: "Welcome to the Jungle",
        language: context.language,
      },
    ],
    queryExecutions: executions,
    warnings,
    offers: rankedOffers,
    normalizedOffers: normalizeDiscoveryOffers(rankedOffers, generatedAt),
    persistence: null,
  };
}
