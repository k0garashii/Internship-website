import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
import type { SearchQueryCandidate } from "@/lib/search/query-plan";
import { cleanHumanText } from "@/lib/text/clean-text";

const LINKEDIN_GUEST_SEARCH_URL =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 9000;

export type LinkedInSearchContext = {
  defaultLocation: string | null;
  language: "fr" | "en";
};

export type LinkedInSearchHit = {
  id: string;
  title: string;
  companyName: string;
  companySlug: string | null;
  locationLabel: string | null;
  sourceUrl: string;
  publishedAt: string | null;
  benefitsText: string | null;
};

export type LinkedInSearchResult = {
  language: "fr" | "en";
  filters: string[];
  totalHits: number;
  hits: LinkedInSearchHit[];
};

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function stripTags(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return cleanHumanText(value);
}

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function normalizeLinkedInUrl(href: string | null | undefined) {
  if (!href) {
    return null;
  }

  try {
    const parsed = new URL(href, LINKEDIN_GUEST_SEARCH_URL);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseCompanySlug(href: string | null | undefined) {
  if (!href) {
    return null;
  }

  try {
    const parsed = new URL(href, LINKEDIN_GUEST_SEARCH_URL);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const companyIndex = parts.findIndex((part) => part === "company");

    if (companyIndex >= 0) {
      return parts[companyIndex + 1] ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

function parseCards(html: string) {
  return Array.from(
    html.matchAll(
      /<li>\s*([\s\S]*?data-entity-urn="urn:li:jobPosting:(\d+)"[\s\S]*?)<\/li>/gi,
    ),
  );
}

function createHitFromCard(match: RegExpMatchArray): LinkedInSearchHit | null {
  const block = match[1];
  const id = match[2];
  const href = normalizeLinkedInUrl(
    block.match(/class="base-card__full-link[^"]*"[^>]+href="([^"]+)"/i)?.[1] ?? null,
  );
  const companyHref =
    block.match(
      /class="hidden-nested-link"[^>]+href="([^"]+)"/i,
    )?.[1] ?? null;
  const title = stripTags(
    block.match(/<h3[^>]+class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? null,
  );
  const companyName = stripTags(
    block.match(/<h4[^>]+class="base-search-card__subtitle"[^>]*>[\s\S]*?<\/h4>/i)?.[0] ?? null,
  );
  const locationLabel = stripTags(
    block.match(
      /<span[^>]+class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1] ?? null,
  );
  const benefitsText = stripTags(
    block.match(
      /<span[^>]+class="job-posting-benefits__text"[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1] ?? null,
  );
  const publishedAtRaw =
    block.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] ?? null;
  const publishedAt =
    publishedAtRaw && !Number.isNaN(Date.parse(publishedAtRaw))
      ? new Date(publishedAtRaw).toISOString()
      : null;

  if (!id || !href || !title || !companyName) {
    return null;
  }

  return {
    id,
    title,
    companyName,
    companySlug: parseCompanySlug(companyHref),
    locationLabel: normalizeWhitespace(locationLabel),
    sourceUrl: href,
    publishedAt,
    benefitsText: normalizeWhitespace(benefitsText),
  };
}

function collectDefaultLocation(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  const explicitLocations = uniqueList(
    searchTargets.preferredLocations.map((location) => location.label),
  );

  if (explicitLocations.length > 0) {
    return explicitLocations[0];
  }

  return normalizeWhitespace(
    [personalProfile.profile.city, personalProfile.profile.countryCode === "FR" ? "France" : null]
      .filter(Boolean)
      .join(", "),
  );
}

export function buildLinkedInSearchContext(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
): LinkedInSearchContext {
  return {
    defaultLocation: collectDefaultLocation(personalProfile, searchTargets),
    language: personalProfile.profile.countryCode === "FR" ? "fr" : "en",
  };
}

export function matchLinkedInQueryKeywords(
  query: SearchQueryCandidate,
  hit: LinkedInSearchHit,
) {
  const searchableText = [
    hit.title,
    hit.companyName,
    hit.locationLabel,
    hit.benefitsText,
    hit.sourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return query.keywords.filter((keyword) => searchableText.includes(keyword.toLowerCase()));
}

export async function searchLinkedInOffers(
  query: SearchQueryCandidate,
  context: LinkedInSearchContext,
  options: {
    start?: number;
  } = {},
): Promise<LinkedInSearchResult> {
  const searchUrl = new URL(LINKEDIN_GUEST_SEARCH_URL);

  searchUrl.searchParams.set("keywords", query.queryText);
  searchUrl.searchParams.set("location", query.location ?? context.defaultLocation ?? "France");
  searchUrl.searchParams.set("start", String(options.start ?? 0));

  const response = await fetch(searchUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": DEFAULT_USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn guest jobs search failed (${response.status})`);
  }

  const html = await response.text();
  const hits = parseCards(html)
    .map((match) => createHitFromCard(match))
    .filter((hit): hit is LinkedInSearchHit => Boolean(hit));

  return {
    language: context.language,
    filters: uniqueList([
      query.location ?? context.defaultLocation,
    ]),
    totalHits: hits.length,
    hits,
  };
}
