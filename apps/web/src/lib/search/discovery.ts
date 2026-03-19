import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
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

function buildOfferScore(offer: Pick<SearchDiscoveryOffer, "contractType" | "matchedKeywords" | "matchedQueryIds" | "profileSnippet" | "publishedAt" | "summary">) {
  let score = 36;

  score += Math.min(offer.matchedQueryIds.length * 18, 36);
  score += Math.min(offer.matchedKeywords.length * 7, 28);

  if (offer.contractType === "internship" || offer.contractType === "apprenticeship") {
    score += 10;
  }

  if (offer.profileSnippet) {
    score += 6;
  }

  if (offer.summary) {
    score += 4;
  }

  if (offer.publishedAt) {
    const ageInDays = (Date.now() - Date.parse(offer.publishedAt)) / (1000 * 60 * 60 * 24);

    if (ageInDays <= 7) {
      score += 10;
    } else if (ageInDays <= 21) {
      score += 6;
    } else if (ageInDays <= 45) {
      score += 3;
    }
  }

  return clamp(Math.round(score), 35, 98);
}

function buildOfferScoreLabel(score: number): SearchDiscoveryOffer["relevanceLabel"] {
  if (score >= 85) {
    return "Tres forte";
  }

  if (score >= 72) {
    return "Forte";
  }

  if (score >= 58) {
    return "Intermediaire";
  }

  return "Exploratoire";
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
    relevanceScore: current.relevanceScore,
    relevanceLabel: current.relevanceLabel,
  };
}

function compareOffers(left: SearchDiscoveryOffer, right: SearchDiscoveryOffer) {
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
  const relevanceScore = buildOfferScore(seedOffer);

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
    relevanceScore,
    relevanceLabel: buildOfferScoreLabel(relevanceScore),
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

  const offers = Array.from(offerMap.values()).sort(compareOffers).slice(0, maxOffers);
  const scoredOffers = offers.map((offer) => {
    const relevanceScore = buildOfferScore(offer);

    return {
      ...offer,
      relevanceScore,
      relevanceLabel: buildOfferScoreLabel(relevanceScore),
    };
  });
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    summary: `Recherche initiale executee sur ${executions.length} requete(s) Welcome to the Jungle pour ${scoredOffers.length} offre(s) dedupliquee(s).`,
    planSummary: plan.summary,
    queryCount: plan.queries.length,
    executedQueryCount: executions.length,
    offerCount: scoredOffers.length,
    providers: [
      {
        id: "wttj",
        label: "Welcome to the Jungle",
        language: context.language,
      },
    ],
    queryExecutions: executions,
    warnings,
    offers: scoredOffers.sort(compareOffers),
    normalizedOffers: normalizeDiscoveryOffers(scoredOffers, generatedAt),
  };
}
