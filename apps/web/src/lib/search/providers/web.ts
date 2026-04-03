import type { SearchQueryCandidate } from "@/lib/search/query-plan";
import type {
  SearchDiscoveryOffer,
  SearchDiscoveryQueryExecution,
} from "@/lib/search/types";
import {
  searchDuckDuckGoHtml,
  type PublicWebSearchResult,
} from "@/lib/web/public-search";

type WebSearchContext = {
  region: string;
};

type WebSearchAttemptDefinition = {
  id: string;
  label: string;
  buildQuery: (query: SearchQueryCandidate) => string;
  maxResults: number;
};

const SEARCH_ATTEMPTS: WebSearchAttemptDefinition[] = [
  {
    id: "broad",
    label: "Recherche web approfondie",
    buildQuery: (query) =>
      [query.queryText, "emploi", "job", "stage", "alternance"].filter(Boolean).join(" "),
    maxResults: 5,
  },
  {
    id: "linkedin",
    label: "Recherche LinkedIn",
    buildQuery: (query) => `site:linkedin.com/jobs/view ${query.queryText}`,
    maxResults: 4,
  },
  {
    id: "indeed",
    label: "Recherche Indeed",
    buildQuery: (query) => `site:indeed.com/jobs ${query.queryText}`,
    maxResults: 4,
  },
  {
    id: "careers",
    label: "Recherche sites carrieres / ATS",
    buildQuery: (query) =>
      [query.targetRole, query.domain, query.location, "careers", "jobs", "recrutement"]
        .filter(Boolean)
        .join(" "),
    maxResults: 5,
  },
];

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function matchQueryKeywords(query: SearchQueryCandidate, result: PublicWebSearchResult) {
  const searchableText = [result.title, result.snippet, result.url].filter(Boolean).join(" ").toLowerCase();

  return query.keywords.filter((keyword) => searchableText.includes(keyword.toLowerCase()));
}

function inferContractType(text: string) {
  const normalized = text.toLowerCase();

  if (normalized.includes("alternance") || normalized.includes("apprenticeship")) {
    return "apprenticeship";
  }
  if (normalized.includes("stage") || normalized.includes("internship") || normalized.includes("intern ")) {
    return "internship";
  }
  if (normalized.includes("freelance")) {
    return "freelance";
  }
  if (normalized.includes("part-time") || normalized.includes("temps partiel")) {
    return "part_time";
  }
  if (normalized.includes("temporary") || normalized.includes("temporaire")) {
    return "temporary";
  }
  if (normalized.includes("full-time") || normalized.includes("temps plein") || normalized.includes("cdi")) {
    return "full_time";
  }

  return null;
}

function inferRemoteMode(text: string) {
  const normalized = text.toLowerCase();

  if (normalized.includes("remote") || normalized.includes("teletravail complet")) {
    return "fulltime";
  }
  if (normalized.includes("hybrid") || normalized.includes("hybride")) {
    return "partial";
  }
  if (normalized.includes("onsite") || normalized.includes("sur site")) {
    return "no";
  }

  return null;
}

function parseRelativePublishedAt(text: string | null) {
  if (!text) {
    return null;
  }

  const normalized = text.toLowerCase();
  const hoursMatch = normalized.match(/(\d+)\s*(hour|hours|heure|heures)/);

  if (hoursMatch) {
    const hours = Number.parseInt(hoursMatch[1], 10);
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }

  const daysMatch = normalized.match(/(\d+)\s*(day|days|jour|jours)/);

  if (daysMatch) {
    const days = Number.parseInt(daysMatch[1], 10);
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  if (normalized.includes("today") || normalized.includes("aujourd")) {
    return new Date().toISOString();
  }

  if (normalized.includes("yesterday") || normalized.includes("hier")) {
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }

  return null;
}

function inferLocation(result: PublicWebSearchResult, query: SearchQueryCandidate) {
  const text = [result.title, result.snippet].filter(Boolean).join(" ");
  const queryLocation = normalizeWhitespace(query.location);

  if (queryLocation && text.toLowerCase().includes(queryLocation.toLowerCase())) {
    return queryLocation;
  }

  const snippetMatch = text.match(
    /\b([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’.-]+(?:,\s*[A-ZÀ-ÿ][A-Za-zÀ-ÿ'’.-]+){0,2})\b/,
  );

  return normalizeWhitespace(snippetMatch?.[1] ?? null);
}

function inferCompanyFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("linkedin.com") || host.includes("indeed.") || host.includes("apec.fr")) {
      return null;
    }

    if (host.includes("greenhouse")) {
      return normalizeWhitespace(parts[0]?.replace(/[-_]+/g, " "));
    }

    if (host.includes("lever.co")) {
      return normalizeWhitespace(parts[0]?.replace(/[-_]+/g, " "));
    }

    if (host.includes("ashbyhq.com")) {
      return normalizeWhitespace(parts[0]?.replace(/[-_]+/g, " "));
    }

    const hostLabel = host.split(".").slice(0, -1).join(" ");
    return normalizeWhitespace(hostLabel.replace(/[-_]+/g, " "));
  } catch {
    return null;
  }
}

function parseTitleParts(title: string) {
  const linkedInMatch = title.match(/^(.*?) hiring (.*?) in (.+?)(?:\.\.\.|$)/i);

  if (linkedInMatch) {
    return {
      companyName: normalizeWhitespace(linkedInMatch[1]),
      title: normalizeWhitespace(linkedInMatch[2]) ?? title,
      locationLabel: normalizeWhitespace(linkedInMatch[3]),
    };
  }

  const atMatch = title.match(/^(.*?)\s+(?:at|chez)\s+(.*)$/i);

  if (atMatch) {
    return {
      companyName: normalizeWhitespace(atMatch[2]),
      title: normalizeWhitespace(atMatch[1]) ?? title,
      locationLabel: null,
    };
  }

  const parts = title.split(/\s+[|·–—-]\s+/).map((part) => normalizeWhitespace(part)).filter(Boolean);

  if (parts.length >= 2) {
    return {
      companyName: parts.length >= 3 ? parts[1] : null,
      title: parts[0] ?? title,
      locationLabel: parts.length >= 3 ? parts[2] : null,
    };
  }

  return {
    companyName: null,
    title: normalizeWhitespace(title) ?? title,
    locationLabel: null,
  };
}

function inferCompanyName(result: PublicWebSearchResult, resolvedTitle: string) {
  const parsed = parseTitleParts(result.title);

  if (parsed.companyName) {
    return parsed.companyName;
  }

  const snippet = normalizeWhitespace(result.snippet);

  if (snippet) {
    const snippetParts = snippet.split(/\s+[|·–—-]\s+/).map((part) => normalizeWhitespace(part)).filter(Boolean);

    if (snippetParts.length >= 2 && snippetParts[0]?.toLowerCase() !== resolvedTitle.toLowerCase()) {
      return snippetParts[0] ?? null;
    }
  }

  return inferCompanyFromUrl(result.url) ?? result.source.label;
}

function buildSummary(result: PublicWebSearchResult) {
  return normalizeWhitespace(result.snippet);
}

function createOfferFromWebResult(
  query: SearchQueryCandidate,
  result: PublicWebSearchResult,
): SearchDiscoveryOffer {
  const parsedTitle = parseTitleParts(result.title);
  const resolvedTitle = parsedTitle.title ?? normalizeWhitespace(result.title) ?? query.targetRole;
  const summary = buildSummary(result);
  const searchableText = [result.title, summary, result.url].filter(Boolean).join(" ");

  return {
    id: `${result.source.id}:${result.id}`,
    provider: result.source.id,
    sourceKind: result.source.kind === "COMPANY_CAREERS" ? "COMPANY_CAREERS" : "JOB_BOARD",
    sourceSite: result.source.label,
    title: resolvedTitle,
    companyName: inferCompanyName(result, resolvedTitle) ?? "Entreprise a confirmer",
    companySlug: null,
    locationLabel: parsedTitle.locationLabel ?? inferLocation(result, query),
    countryCode: null,
    contractType: inferContractType(searchableText),
    remoteMode: inferRemoteMode(searchableText),
    publishedAt: parseRelativePublishedAt(summary),
    sourceUrl: result.url,
    summary,
    profileSnippet: result.displayUrl,
    matchedQueryIds: [query.id],
    matchedQueryLabels: [query.label],
    matchedKeywords: matchQueryKeywords(query, result),
    priorityScore: query.priority,
    relevanceScore: 0,
    relevanceLabel: "Exploratoire",
    matching: {
      score: 18,
      label: "Exploratoire",
      summary: "Match non calcule.",
      breakdown: [],
    },
  };
}

export function buildWebSearchContext(): WebSearchContext {
  return {
    region: "fr-fr",
  };
}

export async function searchWebOffersForQuery(
  query: SearchQueryCandidate,
  context: WebSearchContext,
) {
  const settledAttempts = await Promise.allSettled(
    SEARCH_ATTEMPTS.map(async (attempt) => {
      const queryText = attempt.buildQuery(query);
      const response = await searchDuckDuckGoHtml(queryText, {
        maxResults: attempt.maxResults,
        region: context.region,
      });

      return {
        attempt,
        queryText,
        response,
      };
    }),
  );

  const executions: SearchDiscoveryQueryExecution[] = [];
  const offers: SearchDiscoveryOffer[] = [];
  const warnings: string[] = [];

  settledAttempts.forEach((settled, index) => {
    const attempt = SEARCH_ATTEMPTS[index];

    if (settled.status === "rejected") {
      warnings.push(`La recherche web "${attempt.label}" a echoue pour "${query.label}".`);
      return;
    }

    const queryText = settled.value.queryText;
    const response = settled.value.response;
    const filteredResults = response.results.filter(
      (result) => result.source.id !== "other" || result.url.toLowerCase().includes("/jobs/"),
    );

    executions.push({
      id: `${query.id}:${attempt.id}`,
      label: `${query.label} / ${attempt.label}`,
      targetRole: query.targetRole,
      domain: query.domain,
      location: query.location,
      focusKeywords: query.focusKeywords,
      queryText,
      requestedQueryText: query.queryText,
      provider: "web",
      providerLabel: attempt.label,
      language: "multi",
      filters: [`web-region:${context.region}`],
      totalHits: filteredResults.length,
      returnedHits: filteredResults.length,
    });

    filteredResults.forEach((result) => {
      offers.push(createOfferFromWebResult(query, result));
    });
  });

  return {
    executions,
    offers,
    warnings,
  };
}
