import type { CompanyWatchlistFile } from "@/lib/config/company-watchlist";
import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { InferredSearchPreference } from "@/lib/profile/personalization-model";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
import { discoverCareerSourcesForTargets } from "@/lib/company-targets/discovery";
import { fetchCompanyCareerOffers } from "@/lib/company-targets/offers";
import { generateCompanyTargetSuggestions } from "@/lib/company-targets/suggestions";
import { matchProfileToOffer } from "@/lib/search/matching";
import { normalizeDiscoveryOffers } from "@/lib/search/normalization";
import {
  buildLinkedInSearchContext,
  matchLinkedInQueryKeywords,
  searchLinkedInOffers,
} from "@/lib/search/providers/linkedin";
import {
  buildWttjSearchContext,
  formatWttjLocation,
  mapWttjHitUrl,
  matchQueryKeywords,
  searchWttjOffers,
} from "@/lib/search/providers/wttj";
import {
  buildWebSearchContext,
  searchWebOffersForQuery,
} from "@/lib/search/providers/web";
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
  companyWatchlist: CompanyWatchlistFile;
  inferredPreferences?: InferredSearchPreference[];
};

type DiscoveryOptions = {
  queryLimit?: number;
  hitsPerQuery?: number;
  maxOffers?: number;
};

const COMPANY_TARGET_LIMIT = 4;
const COMPANY_CAREER_SOURCE_LIMIT = 3;
const COMPANY_CAREER_OFFERS_PER_SOURCE = 2;

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

function scoreQueryAgainstText(query: SearchQueryCandidate, text: string) {
  const normalizedText = text.toLowerCase();
  let score = query.priority;

  if (normalizedText.includes(query.targetRole.toLowerCase())) {
    score += 12;
  }
  if (query.domain && normalizedText.includes(query.domain.toLowerCase())) {
    score += 8;
  }
  if (query.location && normalizedText.includes(query.location.toLowerCase())) {
    score += 4;
  }

  query.focusKeywords.forEach((keyword) => {
    if (normalizedText.includes(keyword.toLowerCase())) {
      score += 4;
    }
  });

  query.keywords.forEach((keyword) => {
    if (normalizedText.includes(keyword.toLowerCase())) {
      score += 2;
    }
  });

  return score;
}

function pickBestMatchingQuery(
  queries: SearchQueryCandidate[],
  textParts: Array<string | null | undefined>,
) {
  const searchableText = textParts.filter(Boolean).join(" ").toLowerCase();

  return (
    [...queries].sort(
      (left, right) =>
        scoreQueryAgainstText(right, searchableText) -
        scoreQueryAgainstText(left, searchableText),
    )[0] ?? null
  );
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

function createLinkedInDiscoveryOffer(
  query: SearchQueryCandidate,
  hit: Awaited<ReturnType<typeof searchLinkedInOffers>>["hits"][number],
): SearchDiscoveryOffer {
  const matchedKeywords = matchLinkedInQueryKeywords(query, hit);
  const searchableText = [hit.title, hit.companyName, hit.locationLabel, hit.benefitsText]
    .filter(Boolean)
    .join(" ");
  const scoring = scoreDiscoveryOffer({
    contractType: null,
    matchedKeywords,
    matchedQueryIds: [query.id],
    profileSnippet: hit.benefitsText,
    publishedAt: hit.publishedAt,
    summary: searchableText || null,
  });

  return {
    id: `linkedin:${hit.id}`,
    provider: "linkedin",
    sourceKind: "JOB_BOARD",
    sourceSite: "LinkedIn Jobs",
    title: hit.title,
    companyName: hit.companyName,
    companySlug: hit.companySlug,
    locationLabel: hit.locationLabel,
    countryCode: null,
    contractType: null,
    remoteMode: null,
    publishedAt: hit.publishedAt,
    sourceUrl: hit.sourceUrl,
    summary: hit.benefitsText,
    profileSnippet: null,
    matchedQueryIds: [query.id],
    matchedQueryLabels: [query.label],
    matchedKeywords,
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

function createCompanyCareerDiscoveryOffer(
  queries: SearchQueryCandidate[],
  companyName: string,
  atsProvider: string | null,
  offer: Awaited<ReturnType<typeof fetchCompanyCareerOffers>>["offers"][number],
): SearchDiscoveryOffer {
  const bestQuery =
    pickBestMatchingQuery(queries, [
      offer.title,
      offer.description,
      companyName,
      offer.department,
      offer.locationLabel,
    ]) ?? queries[0];
  const matchedKeywords = bestQuery
    ? bestQuery.keywords.filter((keyword) =>
        [offer.title, offer.description, companyName, offer.department, offer.locationLabel]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword.toLowerCase()),
      )
    : [];
  const providerLabel = atsProvider ?? offer.sourceLabel;
  const providerId = providerLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const scoring = scoreDiscoveryOffer({
    contractType: null,
    matchedKeywords,
    matchedQueryIds: bestQuery ? [bestQuery.id] : [],
    profileSnippet: offer.department,
    publishedAt: offer.publishedAt,
    summary: offer.description,
  });

  return {
    id: `${providerId}:${offer.id}`,
    provider: providerId || "company-careers",
    sourceKind: "COMPANY_CAREERS",
    sourceSite: providerLabel,
    title: offer.title,
    companyName,
    companySlug: null,
    locationLabel: offer.locationLabel,
    countryCode: null,
    contractType: null,
    remoteMode: null,
    publishedAt: offer.publishedAt,
    sourceUrl: offer.sourceUrl,
    summary: offer.description,
    profileSnippet: offer.department,
    matchedQueryIds: bestQuery ? [bestQuery.id] : [],
    matchedQueryLabels: bestQuery ? [bestQuery.label] : [],
    matchedKeywords,
    priorityScore: bestQuery?.priority ?? 50,
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

function buildProviderSummary(
  executions: SearchDiscoveryQueryExecution[],
  offers: SearchDiscoveryOffer[],
) {
  const providers = new Map<
    string,
    {
      id: string;
      label: string;
      language: "fr" | "en" | "multi";
      offerCount: number;
    }
  >();

  const languageByProvider = new Map<string, "fr" | "en" | "multi">();

  executions.forEach((execution) => {
    const existingLanguage = languageByProvider.get(execution.provider);

    if (!existingLanguage) {
      languageByProvider.set(execution.provider, execution.language);
      return;
    }

    if (existingLanguage !== execution.language) {
      languageByProvider.set(execution.provider, "multi");
    }
  });

  offers.forEach((offer) => {
    const providerKey = offer.sourceSite.toLowerCase();
    const existing = providers.get(providerKey);

    if (!existing) {
      providers.set(providerKey, {
        id: offer.provider,
        label: offer.sourceSite,
        language: languageByProvider.get(offer.provider) ?? "multi",
        offerCount: 1,
      });
      return;
    }

    existing.offerCount += 1;
  });

  return Array.from(providers.values()).sort((left, right) => right.offerCount - left.offerCount);
}

function diversifyRankedOffers(scoredOffers: SearchDiscoveryOffer[], maxOffers: number) {
  if (scoredOffers.length <= 1) {
    return scoredOffers.slice(0, maxOffers);
  }

  const buckets = new Map<string, SearchDiscoveryOffer[]>();

  scoredOffers.forEach((offer) => {
    const existing = buckets.get(offer.provider);

    if (existing) {
      existing.push(offer);
      return;
    }

    buckets.set(offer.provider, [offer]);
  });

  const orderedProviders = Array.from(buckets.entries())
    .sort((left, right) => compareOffers(right[1][0], left[1][0]))
    .map(([provider]) => provider);
  const diversityPrefixSize = Math.min(
    maxOffers,
    Math.max(orderedProviders.length * 2, Math.min(scoredOffers.length, 6)),
  );
  const selectedIds = new Set<string>();
  const prefix: SearchDiscoveryOffer[] = [];

  while (prefix.length < diversityPrefixSize) {
    let pickedInRound = false;

    orderedProviders.forEach((provider) => {
      if (prefix.length >= diversityPrefixSize) {
        return;
      }

      const bucket = buckets.get(provider);
      const nextOffer = bucket?.shift();

      if (!nextOffer) {
        return;
      }

      prefix.push(nextOffer);
      selectedIds.add(nextOffer.id);
      pickedInRound = true;
    });

    if (!pickedInRound) {
      break;
    }
  }

  const suffix = scoredOffers.filter((offer) => !selectedIds.has(offer.id));

  return [...prefix, ...suffix].slice(0, maxOffers);
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
  const wttjContext = buildWttjSearchContext(config.personalProfile, config.searchTargets);
  const linkedInContext = buildLinkedInSearchContext(config.personalProfile, config.searchTargets);
  const webContext = buildWebSearchContext();
  const executions: SearchDiscoveryQueryExecution[] = [];
  const warnings: string[] = [];
  const offerMap = new Map<string, SearchDiscoveryOffer>();

  const settledWttjResults = await Promise.allSettled(
    selectedQueries.map((query) => searchQueryWithFallback(query, wttjContext, hitsPerQuery)),
  );

  settledWttjResults.forEach((result, index) => {
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

  const settledLinkedInResults = await Promise.allSettled(
    selectedQueries.map((query) => searchLinkedInOffers(query, linkedInContext)),
  );

  settledLinkedInResults.forEach((result, index) => {
    const query = selectedQueries[index];

    if (result.status === "rejected") {
      warnings.push(`La requete "${query.label}" a echoue sur LinkedIn Jobs.`);
      return;
    }

    executions.push({
      id: `${query.id}:linkedin`,
      label: `${query.label} / LinkedIn`,
      targetRole: query.targetRole,
      domain: query.domain,
      location: query.location,
      focusKeywords: query.focusKeywords,
      queryText: query.queryText,
      requestedQueryText: query.queryText,
      provider: "linkedin",
      providerLabel: "LinkedIn Jobs",
      language: result.value.language,
      filters: result.value.filters,
      totalHits: result.value.totalHits,
      returnedHits: result.value.hits.length,
    });

    result.value.hits.forEach((hit) => {
      const incoming = createLinkedInDiscoveryOffer(query, hit);
      offerMap.set(incoming.id, mergeOffer(offerMap.get(incoming.id), incoming));
    });
  });

  const settledWebResults = await Promise.allSettled(
    selectedQueries.map((query) => searchWebOffersForQuery(query, webContext)),
  );

  settledWebResults.forEach((result, index) => {
    const query = selectedQueries[index];

    if (result.status === "rejected") {
      warnings.push(`La recherche web approfondie a echoue pour "${query.label}".`);
      return;
    }

    result.value.executions.forEach((execution) => {
      executions.push(execution);
    });
    warnings.push(...result.value.warnings);
    result.value.offers.forEach((incoming) => {
      offerMap.set(incoming.id, mergeOffer(offerMap.get(incoming.id), incoming));
    });
  });

  try {
    const suggestions = await generateCompanyTargetSuggestions(
      config.personalProfile,
      config.searchTargets,
      config.companyWatchlist,
      config.inferredPreferences ?? [],
    );
    const careerSources = await discoverCareerSourcesForTargets(
      suggestions.suggestions.slice(0, COMPANY_TARGET_LIMIT),
    );
    const selectedCareerSources = careerSources.results
      .filter((result) => result.status === "found" && result.careerPageUrl)
      .slice(0, COMPANY_CAREER_SOURCE_LIMIT);
    const settledCareerOffers = await Promise.allSettled(
      selectedCareerSources.map((result) =>
        fetchCompanyCareerOffers({
          companyName: result.companyName,
          websiteUrl: result.websiteUrl,
          careerPageUrl: result.careerPageUrl,
          atsProvider: result.atsProvider,
          discoveryMethod: result.discoveryMethod,
        }),
      ),
    );

    settledCareerOffers.forEach((settled, index) => {
      const source = selectedCareerSources[index];

      if (settled.status === "rejected") {
        warnings.push(
          `La lecture directe des offres a echoue pour ${source.companyName}.`,
        );
        return;
      }

      executions.push({
        id: `company-careers:${source.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: `${source.companyName} / ${settled.value.sourceSummary}`,
        targetRole: selectedQueries[0]?.targetRole ?? source.companyName,
        domain: selectedQueries[0]?.domain ?? null,
        location: null,
        focusKeywords: [],
        queryText: source.companyName,
        requestedQueryText: source.companyName,
        provider:
          source.atsProvider?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ??
          "company-careers",
        providerLabel: source.atsProvider ?? "Pages carrieres",
        language: "multi",
        filters: [
          `company:${source.companyName}`,
          `discovery:${source.discoveryMethod}`,
        ],
        totalHits: settled.value.offers.length,
        returnedHits: settled.value.offers.length,
      });

      settled.value.offers.slice(0, COMPANY_CAREER_OFFERS_PER_SOURCE).forEach((offer) => {
        const incoming = createCompanyCareerDiscoveryOffer(
          selectedQueries,
          source.companyName,
          source.atsProvider,
          offer,
        );
        offerMap.set(incoming.id, mergeOffer(offerMap.get(incoming.id), incoming));
      });
    });
  } catch (error) {
    warnings.push("La collecte directe depuis des pages carrieres n a pas pu etre completee.");
  }

  if (executions.length === 0) {
    throw new SearchDiscoveryError(
      "Unable to search offers from the current public source",
      502,
    );
  }

  const scoredOffers = Array.from(offerMap.values()).map((offer) => {
    const scoring = scoreDiscoveryOffer(offer);
    const matching = matchProfileToOffer(
      {
        personalProfile: config.personalProfile,
        searchTargets: config.searchTargets,
        inferredPreferences: config.inferredPreferences,
      },
      offer,
    );

    return {
      ...offer,
      relevanceScore: scoring.score,
      relevanceLabel: scoring.label,
      matching,
    };
  });
  const generatedAt = new Date().toISOString();
  const globallyRankedOffers = scoredOffers.sort(compareOffers);
  const rankedOffers = diversifyRankedOffers(globallyRankedOffers, maxOffers);

  return {
    generatedAt,
    summary: `Recherche initiale executee sur ${executions.length} requete(s) publiques multi-sources pour ${rankedOffers.length} offre(s) dedupliquee(s), puis classee(s) par match et priorite utilisateur.`,
    planSummary: plan.summary,
    queryCount: plan.queries.length,
    executedQueryCount: executions.length,
    offerCount: rankedOffers.length,
    providers: buildProviderSummary(executions, rankedOffers),
    queryExecutions: executions,
    warnings,
    offers: rankedOffers,
    normalizedOffers: normalizeDiscoveryOffers(rankedOffers, generatedAt),
    persistence: null,
  };
}
