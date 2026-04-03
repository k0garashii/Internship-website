import { z } from "zod";

import { logServiceError } from "@/lib/observability/error-logging";
import { cleanHumanText, isHumanReadableSnippet } from "@/lib/text/clean-text";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 9000;
const MAX_OFFERS = 16;
const JOB_KEYWORDS = [
  "job",
  "jobs",
  "career",
  "careers",
  "emploi",
  "recrutement",
  "intern",
  "stage",
  "alternance",
  "software",
  "engineer",
];
const STRONG_JOB_POSTING_KEYWORDS = [
  "stage",
  "alternance",
  "internship",
  "intern",
  "apprenticeship",
  "vacancy",
  "job opening",
  "position",
  "poste",
  "offre",
  "emploi",
  "software engineer",
  "developer",
  "developpeur",
  "ingenieur",
];

const nullableUrlSchema = z
  .union([z.url(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => value || null)
  .default(null);

export const companyOffersPageParamsSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  websiteUrl: nullableUrlSchema,
  careerPageUrl: nullableUrlSchema,
  atsProvider: z
    .union([z.string().trim().min(2).max(80), z.literal(""), z.null(), z.undefined()])
    .transform((value) => value || null)
    .default(null),
  discoveryMethod: z
    .union([z.string().trim().min(2).max(80), z.literal(""), z.null(), z.undefined()])
    .transform((value) => value || null)
    .default(null),
});

const companyCareerOfferSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  locationLabel: z.string().trim().nullish().transform((value) => value || null),
  department: z.string().trim().nullish().transform((value) => value || null),
  publishedAt: z.string().trim().nullish().transform((value) => value || null),
  description: z.string().trim().nullish().transform((value) => value || null),
  sourceUrl: z.url(),
  sourceLabel: z.string().trim().min(1).max(120),
  sourceKind: z.enum(["ATS_API", "CAREER_PAGE_HTML"]),
});

const companyCareerOffersResultSchema = z.object({
  generatedAt: z.string().datetime(),
  companyName: z.string().trim().min(2).max(160),
  websiteUrl: nullableUrlSchema,
  careerPageUrl: nullableUrlSchema,
  atsProvider: z.string().trim().nullish().transform((value) => value || null),
  discoveryMethod: z.string().trim().nullish().transform((value) => value || null),
  sourceSummary: z.string().trim().min(1).max(320),
  summary: z.string().trim().min(1).max(500),
  warnings: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
  offers: z.array(companyCareerOfferSchema).max(MAX_OFFERS),
});

export type CompanyCareerOffer = z.output<typeof companyCareerOfferSchema>;
export type CompanyCareerOffersResult = z.output<typeof companyCareerOffersResultSchema>;
export type CompanyOffersPageParams = z.output<typeof companyOffersPageParamsSchema>;

type GenericHtmlOffer = {
  id: string;
  title: string;
  sourceUrl: string;
  description: string | null;
};

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function stripTags(value: string) {
  return cleanHumanText(value) ?? "";
}

function toAbsoluteUrl(baseUrl: string, value: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function slugifyCompanyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildCompanyOffersHref(params: CompanyOffersPageParams) {
  const query = new URLSearchParams();
  query.set("companyName", params.companyName);

  if (params.websiteUrl) {
    query.set("websiteUrl", params.websiteUrl);
  }
  if (params.careerPageUrl) {
    query.set("careerPageUrl", params.careerPageUrl);
  }
  if (params.atsProvider) {
    query.set("atsProvider", params.atsProvider);
  }
  if (params.discoveryMethod) {
    query.set("discoveryMethod", params.discoveryMethod);
  }

  return `/workspace/search/companies/${slugifyCompanyName(params.companyName)}?${query.toString()}`;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": DEFAULT_USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url} (${response.status})`);
  }

  return {
    url: response.url,
    html: contentType.includes("text/html") ? await response.text() : "",
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": DEFAULT_USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

function extractGreenhouseToken(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parsed.hostname.includes("greenhouse")) {
      return parts[0] ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

function extractLeverToken(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parsed.hostname.includes("lever.co")) {
      return parts.at(-1) ?? parts[0] ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchGreenhouseOffers(careerPageUrl: string) {
  const token = extractGreenhouseToken(careerPageUrl);

  if (!token) {
    throw new Error("Unable to extract Greenhouse board token");
  }

  const payload = await fetchJson<{
    jobs?: Array<{
      id: number;
      title?: string;
      absolute_url?: string;
      location?: { name?: string };
      updated_at?: string;
      content?: string;
      departments?: Array<{ name?: string }>;
    }>;
  }>(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);

  return (payload.jobs ?? [])
    .filter((job) => job.title && job.absolute_url)
    .map((job) =>
      companyCareerOfferSchema.parse({
        id: `greenhouse:${job.id}`,
        title: job.title,
        locationLabel: job.location?.name ?? null,
        department: uniqueList((job.departments ?? []).map((department) => department.name)).join(", ") || null,
        publishedAt: job.updated_at ?? null,
        description: job.content ? stripTags(job.content).slice(0, 420) : null,
        sourceUrl: job.absolute_url,
        sourceLabel: "Greenhouse",
        sourceKind: "ATS_API",
      }),
    );
}

async function fetchLeverOffers(careerPageUrl: string) {
  const token = extractLeverToken(careerPageUrl);

  if (!token) {
    throw new Error("Unable to extract Lever site token");
  }

  const payload = await fetchJson<
    Array<{
      id?: string;
      text?: string;
      hostedUrl?: string;
      descriptionPlain?: string;
      categories?: {
        team?: string;
        location?: string;
        commitment?: string;
      };
      createdAt?: number;
    }>
  >(`https://api.lever.co/v0/postings/${token}?mode=json`);

  return payload
    .filter((job) => job.id && job.text && job.hostedUrl)
    .map((job) =>
      companyCareerOfferSchema.parse({
        id: `lever:${job.id}`,
        title: job.text,
        locationLabel: job.categories?.location ?? null,
        department: uniqueList([job.categories?.team, job.categories?.commitment]).join(" · ") || null,
        publishedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
        description: job.descriptionPlain ? stripTags(job.descriptionPlain).slice(0, 420) : null,
        sourceUrl: job.hostedUrl,
        sourceLabel: "Lever",
        sourceKind: "ATS_API",
      }),
    );
}

function extractAshbyAppData(html: string) {
  const match = html.match(/window\.__appData\s*=\s*(\{[\s\S]*?\})\s*;\s*fetch\(/);

  if (!match) {
    throw new Error("Unable to extract Ashby app data");
  }

  return JSON.parse(match[1]) as {
    organization?: {
      hostedJobsPageSlug?: string;
    };
    jobBoard?: {
      jobPostings?: Array<{
        id?: string;
        title?: string;
        locationName?: string;
        workplaceType?: string | null;
        employmentType?: string | null;
        teamName?: string | null;
        departmentName?: string | null;
        publishedDate?: string | null;
        isListed?: boolean;
      }>;
    };
  };
}

async function fetchAshbyOffers(careerPageUrl: string) {
  const page = await fetchHtml(careerPageUrl);
  const payload = extractAshbyAppData(page.html);
  const slug =
    payload.organization?.hostedJobsPageSlug ??
    page.url.split("/").filter(Boolean).at(-1) ??
    "company";

  return (payload.jobBoard?.jobPostings ?? [])
    .filter((job) => job.id && job.title && job.isListed !== false)
    .map((job) =>
      companyCareerOfferSchema.parse({
        id: `ashby:${job.id}`,
        title: job.title,
        locationLabel: job.locationName ?? null,
        department: uniqueList([job.departmentName, job.teamName, job.employmentType, job.workplaceType]).join(" · ") || null,
        publishedAt: job.publishedDate ?? null,
        description: null,
        sourceUrl: `https://jobs.ashbyhq.com/${slug}/${job.id}`,
        sourceLabel: "Ashby",
        sourceKind: "ATS_API",
      }),
    );
}

function scoreOfferCandidate(url: string, label: string) {
  const normalizedUrl = url.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  let score = 0;

  if (JOB_KEYWORDS.some((keyword) => normalizedUrl.includes(keyword))) {
    score += 35;
  }
  if (JOB_KEYWORDS.some((keyword) => normalizedLabel.includes(keyword))) {
    score += 25;
  }
  if (normalizedUrl.includes("/jobs/") || normalizedUrl.includes("/job/")) {
    score += 25;
  }
  if (normalizedUrl.includes("/careers/") || normalizedUrl.includes("/career/")) {
    score += 15;
  }
  if (normalizedLabel.length >= 12) {
    score += 10;
  }

  return score;
}

function extractGenericHtmlOffers(baseUrl: string, html: string) {
  const offers = new Map<string, GenericHtmlOffer & { score: number }>();
  const anchorRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const label = stripTags(match[2]);
    const sourceUrl = toAbsoluteUrl(baseUrl, href);

    if (!sourceUrl || label.length < 4) {
      continue;
    }

    const score = scoreOfferCandidate(sourceUrl, label);

    if (score < 30) {
      continue;
    }

    const surroundingHtml = html.slice(Math.max(match.index - 220, 0), Math.min(match.index + 360, html.length));
    const description = (() => {
      const cleaned = cleanHumanText(surroundingHtml)?.replace(label, "").trim() ?? null;

      if (!isHumanReadableSnippet(cleaned)) {
        return null;
      }

      return cleaned ? cleaned.slice(0, 320) : null;
    })();
    const candidate = {
      id: `html:${sourceUrl}`,
      title: label,
      sourceUrl,
      description,
      score,
    };
    const existing = offers.get(sourceUrl);

    if (!existing || candidate.score > existing.score) {
      offers.set(sourceUrl, candidate);
    }
  }

  return Array.from(offers.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_OFFERS)
    .map(({ score: _score, ...offer }) => offer);
}

function extractMetaDescription(html: string) {
  return (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    null
  );
}

function extractTitleFromHtml(html: string) {
  return (
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ??
    null
  );
}

async function enrichHtmlOffer(offer: GenericHtmlOffer) {
  try {
    const detail = await fetchHtml(offer.sourceUrl);
    const title = extractTitleFromHtml(detail.html);
    const description = extractMetaDescription(detail.html);

    return {
      ...offer,
      title: title ? stripTags(title).slice(0, 180) : offer.title,
      description: (() => {
        const cleanedDescription = description ? cleanHumanText(description) : offer.description;
        return isHumanReadableSnippet(cleanedDescription)
          ? cleanedDescription?.slice(0, 420) ?? null
          : offer.description;
      })(),
    };
  } catch {
    return offer;
  }
}

function looksLikeActualJobPosting(offer: GenericHtmlOffer) {
  const combined = [offer.title, offer.description, offer.sourceUrl].filter(Boolean).join(" ").toLowerCase();

  if (
    combined.includes("/jobs/") ||
    combined.includes("/job/") ||
    combined.includes("/vacancy/") ||
    combined.includes("/position/") ||
    combined.includes("jobid") ||
    combined.includes("reqid")
  ) {
    return true;
  }

  return STRONG_JOB_POSTING_KEYWORDS.some((keyword) => combined.includes(keyword));
}

async function fetchGenericCareerPageOffers(careerPageUrl: string) {
  const page = await fetchHtml(careerPageUrl);
  const extracted = extractGenericHtmlOffers(page.url, page.html);
  const enriched = await Promise.all(extracted.slice(0, 8).map((offer) => enrichHtmlOffer(offer)));
  const filtered = enriched.filter((offer) => looksLikeActualJobPosting(offer));

  return filtered.map((offer) =>
    companyCareerOfferSchema.parse({
      id: offer.id,
      title: offer.title,
      locationLabel: null,
      department: null,
      publishedAt: null,
      description: isHumanReadableSnippet(offer.description) ? offer.description : null,
      sourceUrl: offer.sourceUrl,
      sourceLabel: "Page carriere",
      sourceKind: "CAREER_PAGE_HTML",
    }),
  );
}

function sortOffers(left: CompanyCareerOffer, right: CompanyCareerOffer) {
  const leftDate = left.publishedAt ? Date.parse(left.publishedAt) : 0;
  const rightDate = right.publishedAt ? Date.parse(right.publishedAt) : 0;

  if (leftDate !== rightDate) {
    return rightDate - leftDate;
  }

  return left.title.localeCompare(right.title, "fr");
}

function deduplicateOffers(offers: CompanyCareerOffer[]) {
  const seen = new Map<string, CompanyCareerOffer>();

  for (const offer of offers) {
    const fingerprint = `${offer.sourceUrl}::${offer.title.toLowerCase()}`;

    if (!seen.has(fingerprint)) {
      seen.set(fingerprint, offer);
    }
  }

  return Array.from(seen.values()).sort(sortOffers).slice(0, MAX_OFFERS);
}

export async function fetchCompanyCareerOffers(
  params: CompanyOffersPageParams,
): Promise<CompanyCareerOffersResult> {
  const warnings: string[] = [];

  if (!params.careerPageUrl) {
    return companyCareerOffersResultSchema.parse({
      generatedAt: new Date().toISOString(),
      companyName: params.companyName,
      websiteUrl: params.websiteUrl,
      careerPageUrl: null,
      atsProvider: params.atsProvider,
      discoveryMethod: params.discoveryMethod,
      sourceSummary: "Aucun point d entree carriere n a ete fourni pour cette entreprise.",
      summary: "Impossible de recuperer des offres tant qu aucune page carriere ou ATS n a ete detecte.",
      warnings: ["Commence par lancer la decouverte des pages carrieres / ATS depuis la page de recherche."],
      offers: [],
    });
  }

  const sources: CompanyCareerOffer[] = [];

  try {
    if (params.atsProvider === "Greenhouse" || params.careerPageUrl.includes("greenhouse")) {
      sources.push(...(await fetchGreenhouseOffers(params.careerPageUrl)));
    } else if (params.atsProvider === "Ashby" || params.careerPageUrl.includes("ashbyhq.com")) {
      sources.push(...(await fetchAshbyOffers(params.careerPageUrl)));
    } else if (params.atsProvider === "Lever" || params.careerPageUrl.includes("lever.co")) {
      sources.push(...(await fetchLeverOffers(params.careerPageUrl)));
    } else {
      if (params.atsProvider) {
        warnings.push(`ATS ${params.atsProvider} non interroge en API publique, fallback HTML utilise.`);
      }
      sources.push(...(await fetchGenericCareerPageOffers(params.careerPageUrl)));
    }
  } catch (error) {
    logServiceError({
      scope: "company-targets/offers",
      message: "Primary company offer fetcher failed, generic fallback attempted",
      error,
      metadata: {
        companyName: params.companyName,
        careerPageUrl: params.careerPageUrl,
        atsProvider: params.atsProvider,
      },
    });

    warnings.push("La lecture directe de la source ATS a echoue, tentative de lecture HTML.");

    try {
      sources.push(...(await fetchGenericCareerPageOffers(params.careerPageUrl)));
    } catch (fallbackError) {
      logServiceError({
        scope: "company-targets/offers",
        message: "Generic company career page fallback also failed",
        error: fallbackError,
        metadata: {
          companyName: params.companyName,
          careerPageUrl: params.careerPageUrl,
          atsProvider: params.atsProvider,
        },
      });

      warnings.push("Impossible de lire les offres depuis la page carriere fournie.");
    }
  }

  const offers = deduplicateOffers(sources);
  const sourceSummary = params.atsProvider
    ? `${params.companyName} est reliee a ${params.atsProvider}${params.discoveryMethod ? ` via ${params.discoveryMethod}` : ""}.`
    : `${params.companyName} est lue depuis sa page carriere detectee automatiquement.`;

  return companyCareerOffersResultSchema.parse({
    generatedAt: new Date().toISOString(),
    companyName: params.companyName,
    websiteUrl: params.websiteUrl,
    careerPageUrl: params.careerPageUrl,
    atsProvider: params.atsProvider,
    discoveryMethod: params.discoveryMethod,
    sourceSummary,
    summary:
      offers.length > 0
        ? `${offers.length} offre(s) lue(s) depuis la source carriere de ${params.companyName}.`
        : `Aucune offre exploitable n a ete extraite pour ${params.companyName}.`,
    warnings: uniqueList(warnings),
    offers,
  });
}
