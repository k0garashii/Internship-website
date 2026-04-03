import { cleanHumanText } from "@/lib/text/clean-text";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 9000;
const BING_RSS_SEARCH_URL = "https://www.bing.com/search";
const CAREER_KEYWORDS = [
  "careers",
  "career",
  "jobs",
  "job",
  "join-us",
  "join us",
  "recrutement",
  "emploi",
  "carrieres",
  "talent",
  "vacancies",
  "vacancy",
  "work with us",
] as const;
const JOB_POSTING_KEYWORDS = [
  "offre",
  "emploi",
  "job",
  "jobs",
  "stage",
  "alternance",
  "internship",
  "intern",
  "apprenticeship",
  "hiring",
  "poste",
  "position",
  "vacancy",
  "opening",
  "apply",
] as const;

export type PublicJobSource = {
  id: string;
  label: string;
  kind: "JOB_BOARD" | "COMPANY_CAREERS" | "OTHER";
  atsProvider: string | null;
};

export type PublicWebSearchResult = {
  id: string;
  url: string;
  title: string;
  snippet: string | null;
  displayUrl: string | null;
  source: PublicJobSource;
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    });
}

function stripTags(value: string) {
  return cleanHumanText(decodeHtmlEntities(value)) ?? "";
}

function createResultId(url: string) {
  return url.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export function classifyAtsProvider(url: string) {
  const normalized = url.toLowerCase();

  if (normalized.includes("greenhouse")) {
    return "Greenhouse";
  }
  if (normalized.includes("lever.co")) {
    return "Lever";
  }
  if (normalized.includes("smartrecruiters")) {
    return "SmartRecruiters";
  }
  if (normalized.includes("myworkdayjobs") || normalized.includes("workdayjobs")) {
    return "Workday";
  }
  if (normalized.includes("recruitee")) {
    return "Recruitee";
  }
  if (normalized.includes("ashbyhq")) {
    return "Ashby";
  }
  if (normalized.includes("teamtailor")) {
    return "Teamtailor";
  }
  if (normalized.includes("jobvite")) {
    return "Jobvite";
  }
  if (normalized.includes("welcometothejungle")) {
    return "Welcome to the Jungle";
  }
  if (normalized.includes("taleo")) {
    return "Taleo";
  }

  return null;
}

export function hasCareerSignal(text: string) {
  const normalized = text.toLowerCase();
  return CAREER_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function classifyPublicJobSource(url: string): PublicJobSource {
  const normalized = url.toLowerCase();
  const atsProvider = classifyAtsProvider(normalized);

  if (normalized.includes("linkedin.com/jobs/")) {
    return {
      id: "linkedin",
      label: "LinkedIn Jobs",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("indeed.") && (normalized.includes("/jobs") || normalized.includes("/viewjob"))) {
    return {
      id: "indeed",
      label: "Indeed",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("apec.fr")) {
    return {
      id: "apec",
      label: "Apec",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("jobteaser.com")) {
    return {
      id: "jobteaser",
      label: "JobTeaser",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("hellowork.com")) {
    return {
      id: "hellowork",
      label: "HelloWork",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("francetravail.fr") || normalized.includes("pole-emploi.fr")) {
    return {
      id: "france-travail",
      label: "France Travail",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("cadremploi.fr")) {
    return {
      id: "cadremploi",
      label: "Cadremploi",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("meteojob.com")) {
    return {
      id: "meteojob",
      label: "Meteojob",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("jobijoba.com")) {
    return {
      id: "jobijoba",
      label: "Jobijoba",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("monster.")) {
    return {
      id: "monster",
      label: "Monster",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("glassdoor.")) {
    return {
      id: "glassdoor",
      label: "Glassdoor",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (normalized.includes("talent.com")) {
    return {
      id: "talent",
      label: "Talent.com",
      kind: "JOB_BOARD",
      atsProvider: null,
    };
  }

  if (atsProvider) {
    return {
      id: atsProvider.toLowerCase().replace(/\s+/g, "-"),
      label: atsProvider,
      kind: "COMPANY_CAREERS",
      atsProvider,
    };
  }

  if (hasCareerSignal(normalized)) {
    return {
      id: "company-careers",
      label: "Page carriere",
      kind: "COMPANY_CAREERS",
      atsProvider: null,
    };
  }

  return {
    id: "other",
    label: "Web",
    kind: "OTHER",
    atsProvider: null,
  };
}

function looksLikeJobResult(result: {
  title: string;
  snippet: string | null;
  url: string;
  source: PublicJobSource;
}) {
  if (result.source.kind !== "OTHER") {
    return true;
  }

  const text = [result.title, result.snippet, result.url].filter(Boolean).join(" ").toLowerCase();
  return JOB_POSTING_KEYWORDS.some((keyword) => text.includes(keyword));
}

function mapRegionToBingMarket(region: string | undefined) {
  const normalized = (region ?? "fr-fr").toLowerCase();

  if (normalized.startsWith("fr")) {
    return {
      market: "fr-FR",
      country: "fr",
      language: "fr-FR",
    };
  }

  return {
    market: "en-US",
    country: "us",
    language: "en-US",
  };
}

function extractRssItems(xml: string) {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map((match) => {
    const item = match[1];
    const title = decodeHtmlEntities(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const url = decodeHtmlEntities(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
    const snippet = stripTags(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "");

    return {
      title,
      url,
      snippet: snippet || null,
    };
  });
}

export async function searchPublicWeb(
  query: string,
  options: {
    region?: string;
    maxResults?: number;
  } = {},
) {
  const locale = mapRegionToBingMarket(options.region);
  const searchUrl = new URL(BING_RSS_SEARCH_URL);

  searchUrl.searchParams.set("format", "rss");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("cc", locale.country);
  searchUrl.searchParams.set("mkt", locale.market);
  searchUrl.searchParams.set("setlang", locale.language);

  const response = await fetch(searchUrl, {
    headers: {
      accept: "application/rss+xml,application/xml,text/xml",
      "user-agent": DEFAULT_USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Bing RSS search failed (${response.status})`);
  }

  const xml = await response.text();
  const maxResults = options.maxResults ?? 8;

  const results = extractRssItems(xml)
    .map((result) => {
      if (!result.url) {
        return null;
      }

      const source = classifyPublicJobSource(result.url);

      return {
        id: createResultId(result.url),
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        displayUrl: (() => {
          try {
            return new URL(result.url).hostname.replace(/^www\./, "");
          } catch {
            return null;
          }
        })(),
        source,
      } satisfies PublicWebSearchResult;
    })
    .filter((result): result is PublicWebSearchResult => Boolean(result))
    .filter((result) => looksLikeJobResult(result))
    .slice(0, maxResults);

  return {
    query,
    results,
  };
}

export async function searchDuckDuckGoHtml(
  query: string,
  options: {
    region?: string;
    maxResults?: number;
  } = {},
) {
  return searchPublicWeb(query, options);
}
