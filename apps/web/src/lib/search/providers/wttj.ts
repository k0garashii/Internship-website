import { z } from "zod";

import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
import type { SearchQueryCandidate } from "@/lib/search/query-plan";

const WTTJ_JOBS_PAGE_URL = "https://www.welcometothejungle.com/en/jobs";
const WTTJ_SEARCH_CONFIG_TTL_MS = 1000 * 60 * 15;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const employmentTypeMap: Record<string, string> = {
  INTERNSHIP: "internship",
  APPRENTICESHIP: "apprenticeship",
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
  TEMPORARY: "temporary",
  FREELANCE: "freelance",
};

const wttjOfficeSchema = z.object({
  city: z.string().trim().nullish().transform((value) => value || null),
  country: z.string().trim().nullish().transform((value) => value || null),
  country_code: z.string().trim().max(2).nullish().transform((value) => value || null),
});

const wttjHitSchema = z.object({
  objectID: z.string().trim().min(1),
  reference: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  summary: z.string().trim().nullish().transform((value) => value || null),
  profile: z.string().trim().nullish().transform((value) => value || null),
  contract_type: z.string().trim().nullish().transform((value) => value || null),
  remote: z.string().trim().nullish().transform((value) => value || null),
  published_at: z.string().trim().nullish().transform((value) => value || null),
  offices: z.array(wttjOfficeSchema).default([]),
  organization: z.object({
    name: z.string().trim().min(1),
    slug: z.string().trim().nullish().transform((value) => value || null),
  }),
});

const wttjResponseSchema = z.object({
  hits: z.array(wttjHitSchema).default([]),
  nbHits: z.number().int().nonnegative().default(0),
});

type WttjHit = z.output<typeof wttjHitSchema>;

type WttjPublicConfig = {
  appId: string;
  apiKey: string;
  jobsIndexPrefix: string;
};

export type WttjSearchContext = {
  language: "fr" | "en";
  filters: string[];
  filterExpression: string | null;
};

export type WttjSearchResult = {
  language: "fr" | "en";
  filters: string[];
  totalHits: number;
  hits: WttjHit[];
};

let cachedConfig:
  | {
      value: WttjPublicConfig;
      expiresAt: number;
    }
  | null = null;

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function collectCountryCodes(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  const explicitCountryCodes = uniqueList(
    searchTargets.preferredLocations.map((location) => location.countryCode),
  );

  if (explicitCountryCodes.length > 0) {
    return explicitCountryCodes.slice(0, 3);
  }

  return uniqueList([personalProfile.profile.countryCode]).slice(0, 1);
}

function collectContractTypes(searchTargets: SearchTargetsFile) {
  return uniqueList(
    searchTargets.targets.flatMap((target) =>
      target.employmentTypes.map((employmentType) => employmentTypeMap[employmentType]),
    ),
  );
}

function buildFilterGroup(field: string, values: string[]) {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return `${field}:${values[0]}`;
  }

  return `(${values.map((value) => `${field}:${value}`).join(" OR ")})`;
}

function buildWttjFilters(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  const countryCodes = collectCountryCodes(personalProfile, searchTargets);
  const contractTypes = collectContractTypes(searchTargets);

  return uniqueList([
    buildFilterGroup("offices.country_code", countryCodes),
    buildFilterGroup("contract_type", contractTypes),
  ]);
}

function resolveWttjLanguage(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
): "fr" | "en" {
  const countryCodes = collectCountryCodes(personalProfile, searchTargets);

  return countryCodes.includes("FR") ? "fr" : "en";
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": DEFAULT_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url} (${response.status})`);
  }

  return response.text();
}

function extractPublicConfig(html: string): WttjPublicConfig {
  const appId = html.match(/"ALGOLIA_APPLICATION_ID":"([^"]+)"/)?.[1];
  const apiKey = html.match(/"ALGOLIA_API_KEY_CLIENT":"([^"]+)"/)?.[1];
  const jobsIndexPrefix = html.match(/"ALGOLIA_JOBS_INDEX_PREFIX":"([^"]+)"/)?.[1];

  if (!appId || !apiKey || !jobsIndexPrefix) {
    throw new Error("Unable to extract Welcome to the Jungle public search config");
  }

  return {
    appId,
    apiKey,
    jobsIndexPrefix,
  };
}

async function getWttjPublicConfig() {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) {
    return cachedConfig.value;
  }

  const html = await fetchText(WTTJ_JOBS_PAGE_URL);
  const value = extractPublicConfig(html);

  cachedConfig = {
    value,
    expiresAt: Date.now() + WTTJ_SEARCH_CONFIG_TTL_MS,
  };

  return value;
}

function buildJobUrl(hit: WttjHit, language: "fr" | "en") {
  const organizationSlug = hit.organization.slug ?? "company";
  return `https://www.welcometothejungle.com/${language}/companies/${organizationSlug}/jobs/${hit.slug}`;
}

function buildQueryParams(
  query: SearchQueryCandidate,
  context: WttjSearchContext,
  hitsPerPage: number,
) {
  const params = new URLSearchParams({
    query: query.queryText,
    hitsPerPage: hitsPerPage.toString(),
    page: "0",
    attributesToRetrieve: [
      "reference",
      "name",
      "slug",
      "summary",
      "profile",
      "published_at",
      "contract_type",
      "remote",
      "offices",
      "organization",
    ].join(","),
  });

  if (context.filterExpression) {
    params.set("filters", context.filterExpression);
  }

  return params.toString();
}

export function buildWttjSearchContext(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
): WttjSearchContext {
  const filters = buildWttjFilters(personalProfile, searchTargets);

  return {
    language: resolveWttjLanguage(personalProfile, searchTargets),
    filters,
    filterExpression: filters.length > 0 ? filters.join(" AND ") : null,
  };
}

export function formatWttjLocation(hit: WttjHit) {
  const primaryOffice = hit.offices.find((office) => office.city || office.country);

  if (!primaryOffice) {
    return {
      locationLabel: null,
      countryCode: null,
    };
  }

  return {
    locationLabel: [primaryOffice.city, primaryOffice.country].filter(Boolean).join(", ") || null,
    countryCode: primaryOffice.country_code,
  };
}

export function matchQueryKeywords(query: SearchQueryCandidate, hit: WttjHit) {
  const searchableText = [hit.name, hit.summary, hit.profile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return query.keywords.filter((keyword) => searchableText.includes(keyword.toLowerCase()));
}

export async function searchWttjOffers(
  query: SearchQueryCandidate,
  context: WttjSearchContext,
  options: { hitsPerPage?: number } = {},
): Promise<WttjSearchResult> {
  const hitsPerPage = options.hitsPerPage ?? 4;
  const config = await getWttjPublicConfig();
  const indexName = `${config.jobsIndexPrefix}_${context.language}`;
  const response = await fetch(`https://${config.appId}-dsn.algolia.net/1/indexes/${indexName}/query`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: "https://www.welcometothejungle.com",
      referer: "https://www.welcometothejungle.com/",
      "user-agent": DEFAULT_USER_AGENT,
      "x-algolia-agent": "Algolia for JavaScript (4.24.0); Browser",
      "x-algolia-api-key": config.apiKey,
      "x-algolia-application-id": config.appId,
    },
    body: JSON.stringify({
      params: buildQueryParams(query, context, hitsPerPage),
    }),
  });

  if (!response.ok) {
    throw new Error(`Welcome to the Jungle search failed (${response.status})`);
  }

  const parsed = wttjResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error("Welcome to the Jungle search payload is invalid");
  }

  return {
    language: context.language,
    filters: context.filters,
    totalHits: parsed.data.nbHits,
    hits: parsed.data.hits,
  };
}

export function mapWttjHitUrl(hit: WttjHit, language: "fr" | "en") {
  return buildJobUrl(hit, language);
}
