import { z } from "zod";

import {
  companyTargetSuggestionItemSchema,
  type CompanyTargetSuggestionItem,
} from "@/lib/company-targets/suggestions";
import { logServiceError } from "@/lib/observability/error-logging";
import {
  classifyAtsProvider,
  hasCareerSignal,
  searchDuckDuckGoHtml,
} from "@/lib/web/public-search";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 7000;
const MAX_TARGETS = 8;
const COMMON_CAREER_PATHS = [
  "/careers",
  "/career",
  "/jobs",
  "/join-us",
  "/careers/jobs",
  "/recrutement",
  "/emploi",
  "/carrieres",
  "/about/careers",
  "/company/careers",
  "/about/jobs",
] as const;

export const companyTargetDiscoveryRequestSchema = z.object({
  targets: z.array(companyTargetSuggestionItemSchema).min(1).max(12),
});

const discoveryStatusSchema = z.enum(["found", "not_found", "error"]);
const discoveryMethodSchema = z.enum([
  "provided",
  "homepage_link",
  "common_path",
  "web_search",
  "unresolved",
  "error",
]);
const discoveryConfidenceSchema = z.enum(["high", "medium", "low"]);

const careerSourceDiscoveryItemSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  websiteUrl: z.string().url().nullish().transform((value) => value || null),
  careerPageUrl: z.string().url().nullish().transform((value) => value || null),
  status: discoveryStatusSchema,
  discoveryMethod: discoveryMethodSchema,
  confidence: discoveryConfidenceSchema,
  atsProvider: z.string().trim().max(80).nullish().transform((value) => value || null),
  checkedUrls: z.array(z.string().url()).max(12).default([]),
  notes: z.string().trim().max(240).nullish().transform((value) => value || null),
});

const careerSourceDiscoverySchema = z.object({
  generatedAt: z.string().datetime(),
  summary: z.string().trim().min(1).max(400),
  results: z.array(careerSourceDiscoveryItemSchema).min(1).max(MAX_TARGETS),
});

export type CareerSourceDiscoveryResult = z.output<typeof careerSourceDiscoverySchema>;

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function scoreCareerCandidate(url: string, label: string) {
  const normalizedUrl = url.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  let score = 0;

  if (hasCareerSignal(normalizedUrl)) {
    score += 45;
  }
  if (hasCareerSignal(normalizedLabel)) {
    score += 30;
  }
  if (classifyAtsProvider(normalizedUrl)) {
    score += 40;
  }
  if (normalizedUrl.includes("/blog") || normalizedUrl.includes("/news")) {
    score -= 25;
  }

  return score;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(baseUrl: string, value: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractCareerLinks(baseUrl: string, html: string) {
  const links = new Map<string, { url: string; label: string; score: number }>();
  const anchorRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const label = stripTags(match[2]);
    const absoluteUrl = toAbsoluteUrl(baseUrl, href);

    if (!absoluteUrl) {
      continue;
    }

    const score = scoreCareerCandidate(absoluteUrl, label);

    if (score < 35) {
      continue;
    }

    const existing = links.get(absoluteUrl);

    if (!existing || score > existing.score) {
      links.set(absoluteUrl, {
        url: absoluteUrl,
        label,
        score,
      });
    }
  }

  return Array.from(links.values()).sort((left, right) => right.score - left.score);
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": DEFAULT_USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "follow",
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    contentType,
    html: contentType.includes("text/html") ? await response.text() : "",
  };
}

async function validateCareerUrl(url: string) {
  try {
    const response = await fetchHtml(url);

    if (!response.ok) {
      return null;
    }

    const atsProvider = classifyAtsProvider(response.url);
    const notes = atsProvider
      ? `Point d entree ATS detecte via ${atsProvider}.`
      : hasCareerSignal(response.url) || hasCareerSignal(response.html.slice(0, 2000))
        ? "Page carriere verifiee avec un signal explicite."
        : "URL validee comme point d entree potentiel.";

    return {
      url: response.url,
      atsProvider,
      notes,
    };
  } catch {
    return null;
  }
}

function createResolvedResult(
  target: CompanyTargetSuggestionItem,
  options: {
    careerPageUrl: string;
    discoveryMethod: "provided" | "homepage_link" | "common_path" | "web_search";
    confidence: "high" | "medium" | "low";
    atsProvider?: string | null;
    checkedUrls?: string[];
    notes?: string | null;
  },
) {
  return careerSourceDiscoveryItemSchema.parse({
    companyName: target.companyName,
    websiteUrl: target.websiteUrl,
    careerPageUrl: options.careerPageUrl,
    status: "found",
    discoveryMethod: options.discoveryMethod,
    confidence: options.confidence,
    atsProvider: options.atsProvider ?? null,
    checkedUrls: uniqueList(options.checkedUrls ?? []),
    notes: options.notes ?? null,
  });
}

function createFallbackResult(
  target: CompanyTargetSuggestionItem,
  options: {
    status: "not_found" | "error";
    checkedUrls?: string[];
    notes?: string | null;
  },
) {
  return careerSourceDiscoveryItemSchema.parse({
    companyName: target.companyName,
    websiteUrl: target.websiteUrl,
    careerPageUrl: null,
    status: options.status,
    discoveryMethod: options.status === "error" ? "error" : "unresolved",
    confidence: "low",
    atsProvider: null,
    checkedUrls: uniqueList(options.checkedUrls ?? []),
    notes: options.notes ?? null,
  });
}

async function probeCommonPaths(baseUrl: string, checkedUrls: string[]) {
  for (const path of COMMON_CAREER_PATHS) {
    const candidateUrl = new URL(path, baseUrl).toString();
    checkedUrls.push(candidateUrl);
    const validated = await validateCareerUrl(candidateUrl);

    if (validated) {
      return validated;
    }
  }

  return null;
}

function extractHostname(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function scoreWebCareerCandidate(
  target: CompanyTargetSuggestionItem,
  candidate: {
    url: string;
    title: string;
    snippet: string | null;
    sourceKind: "JOB_BOARD" | "COMPANY_CAREERS" | "OTHER";
  },
) {
  const normalizedUrl = candidate.url.toLowerCase();
  const text = [candidate.title, candidate.snippet, candidate.url].filter(Boolean).join(" ").toLowerCase();
  const websiteHost = extractHostname(target.websiteUrl);
  const candidateHost = extractHostname(candidate.url);
  let score = 0;

  if (candidate.sourceKind === "COMPANY_CAREERS") {
    score += 70;
  }
  if (classifyAtsProvider(candidate.url)) {
    score += 55;
  }
  if (candidateHost && websiteHost && candidateHost.includes(websiteHost)) {
    score += 30;
  }
  if (text.includes(target.companyName.toLowerCase())) {
    score += 18;
  }
  if (hasCareerSignal(text)) {
    score += 20;
  }
  if (normalizedUrl.includes("/blog") || normalizedUrl.includes("/news")) {
    score -= 25;
  }

  return score;
}

async function searchCareerSourceOnWeb(
  target: CompanyTargetSuggestionItem,
  checkedUrls: string[],
) {
  const websiteHost = extractHostname(target.websiteUrl);
  const queries = uniqueList([
    websiteHost ? `site:${websiteHost} careers jobs recrutement` : null,
    `${target.companyName} careers jobs recrutement`,
  ]);
  const candidates: Array<{
    url: string;
    title: string;
    snippet: string | null;
    sourceKind: "JOB_BOARD" | "COMPANY_CAREERS" | "OTHER";
    score: number;
  }> = [];

  for (const queryText of queries) {
    const result = await searchDuckDuckGoHtml(queryText, {
      maxResults: 6,
      region: "fr-fr",
    });

    result.results.forEach((item) => {
      checkedUrls.push(item.url);
      const score = scoreWebCareerCandidate(target, {
        url: item.url,
        title: item.title,
        snippet: item.snippet,
        sourceKind: item.source.kind,
      });

      if (score >= 55) {
        candidates.push({
          url: item.url,
          title: item.title,
          snippet: item.snippet,
          sourceKind: item.source.kind,
          score,
        });
      }
    });
  }

  const bestCandidate = candidates.sort((left, right) => right.score - left.score)[0];

  if (!bestCandidate) {
    return null;
  }

  const validated = await validateCareerUrl(bestCandidate.url);

  if (!validated) {
    return null;
  }

  return {
    ...validated,
    notes: bestCandidate.title
      ? `Resultat de recherche web: ${bestCandidate.title}.`
      : validated.notes,
  };
}

export async function discoverCareerSourcesForTargets(
  targets: CompanyTargetSuggestionItem[],
): Promise<CareerSourceDiscoveryResult> {
  const selectedTargets = targets.slice(0, MAX_TARGETS);
  const settled = await Promise.all(
    selectedTargets.map(async (target) => {
      const checkedUrls: string[] = [];

      try {
        if (target.careerPageUrl) {
          checkedUrls.push(target.careerPageUrl);
          const validatedCareerPage = await validateCareerUrl(target.careerPageUrl);

          if (validatedCareerPage) {
            return createResolvedResult(target, {
              careerPageUrl: validatedCareerPage.url,
              discoveryMethod: "provided",
              confidence: "high",
              atsProvider: validatedCareerPage.atsProvider,
              checkedUrls,
              notes: validatedCareerPage.notes,
            });
          }
        }

        if (!target.websiteUrl) {
          return createFallbackResult(target, {
            status: "not_found",
            checkedUrls,
            notes: "Aucun site officiel disponible pour lancer la decouverte.",
          });
        }

        checkedUrls.push(target.websiteUrl);
        const homepage = await fetchHtml(target.websiteUrl);

        if (homepage.ok && homepage.html) {
          const links = extractCareerLinks(homepage.url, homepage.html);

          if (links.length > 0) {
            const candidate = links[0];
            checkedUrls.push(candidate.url);
            const validatedCandidate = await validateCareerUrl(candidate.url);

            if (validatedCandidate) {
              return createResolvedResult(target, {
                careerPageUrl: validatedCandidate.url,
                discoveryMethod: "homepage_link",
                confidence: classifyAtsProvider(validatedCandidate.url) ? "high" : "medium",
                atsProvider: validatedCandidate.atsProvider,
                checkedUrls,
                notes: `Lien detecte depuis la home: ${candidate.label || candidate.url}.`,
              });
            }
          }

          const commonPathMatch = await probeCommonPaths(homepage.url, checkedUrls);

          if (commonPathMatch) {
            return createResolvedResult(target, {
              careerPageUrl: commonPathMatch.url,
              discoveryMethod: "common_path",
              confidence: classifyAtsProvider(commonPathMatch.url) ? "medium" : "low",
              atsProvider: commonPathMatch.atsProvider,
              checkedUrls,
              notes: commonPathMatch.notes,
            });
          }
        }

        const webSearchMatch = await searchCareerSourceOnWeb(target, checkedUrls);

        if (webSearchMatch) {
          return createResolvedResult(target, {
            careerPageUrl: webSearchMatch.url,
            discoveryMethod: "web_search",
            confidence: classifyAtsProvider(webSearchMatch.url) ? "high" : "medium",
            atsProvider: webSearchMatch.atsProvider,
            checkedUrls,
            notes: webSearchMatch.notes,
          });
        }

        return createFallbackResult(target, {
          status: "not_found",
          checkedUrls,
          notes: "Aucun point d entree carriere explicite detecte automatiquement.",
        });
      } catch (error) {
        logServiceError({
          scope: "company-targets/discovery",
          message: "Career source discovery failed for a target and returned an error fallback",
          error,
          metadata: {
            companyName: target.companyName,
            checkedUrls,
          },
        });

        return createFallbackResult(target, {
          status: "error",
          checkedUrls,
          notes: "La decouverte a echoue sur cette cible.",
        });
      }
    }),
  );

  const foundCount = settled.filter((item) => item.status === "found").length;
  const atsCount = settled.filter((item) => item.atsProvider).length;

  return careerSourceDiscoverySchema.parse({
    generatedAt: new Date().toISOString(),
    summary: `${foundCount} entreprise(s) sur ${settled.length} avec un point d entree carriere detecte automatiquement, dont ${atsCount} ATS explicitement identifies.`,
    results: settled,
  });
}
