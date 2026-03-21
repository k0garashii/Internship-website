import { Prisma, ProfileEnrichmentStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { logServiceError } from "@/lib/observability/error-logging";
import { normalizeListItem, slugify } from "@/lib/profile/schema";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_REPOS = 12;
const MAX_SIGNALS = 20;

type EnrichmentSourceKind = "PORTFOLIO" | "GITHUB" | "RESUME";

type ExtractedSignal = {
  label: string;
  normalizedLabel: string;
  category: "technology" | "domain" | "keyword" | "role";
  score: number;
  sources: EnrichmentSourceKind[];
};

type SourceSnapshot = {
  source: EnrichmentSourceKind;
  url: string;
  status: "READY" | "FAILED" | "SKIPPED";
  title: string | null;
  summary: string | null;
  fetchedAt: string;
  error: string | null;
  rawSignals: string[];
  metadata?: Record<string, unknown>;
};

type ExtractionResult = {
  snapshot: SourceSnapshot;
  text: string;
  signals: Array<{
    label: string;
    category: ExtractedSignal["category"];
    score: number;
  }>;
};

const technologyPatterns = [
  { label: "C++", pattern: /\bc\+\+\b/gi, score: 7 },
  { label: "C", pattern: /\bc\b/gi, score: 2 },
  { label: "Python", pattern: /\bpython\b/gi, score: 7 },
  { label: "TypeScript", pattern: /\btypescript\b/gi, score: 6 },
  { label: "JavaScript", pattern: /\bjavascript\b/gi, score: 5 },
  { label: "React", pattern: /\breact\b/gi, score: 4 },
  { label: "Next.js", pattern: /\bnext(?:\.js)?\b/gi, score: 5 },
  { label: "Node.js", pattern: /\bnode(?:\.js)?\b/gi, score: 5 },
  { label: "OpenGL", pattern: /\bopengl\b/gi, score: 7 },
  { label: "Vulkan", pattern: /\bvulkan\b/gi, score: 7 },
  { label: "CMake", pattern: /\bcmake\b/gi, score: 5 },
  { label: "Prisma", pattern: /\bprisma\b/gi, score: 4 },
  { label: "PostgreSQL", pattern: /\bpostgres(?:ql)?\b/gi, score: 4 },
  { label: "Docker", pattern: /\bdocker\b/gi, score: 4 },
  { label: "Kubernetes", pattern: /\bkubernetes\b|\bk8s\b/gi, score: 5 },
  { label: "CUDA", pattern: /\bcuda\b/gi, score: 6 },
  { label: "OpenMP", pattern: /\bopenmp\b/gi, score: 5 },
  { label: "MPI", pattern: /\bmpi\b/gi, score: 5 },
  { label: "WebGL", pattern: /\bwebgl\b/gi, score: 5 },
  { label: "Three.js", pattern: /\bthree\.js\b|\bthreejs\b/gi, score: 4 },
  { label: "Git", pattern: /\bgit\b/gi, score: 3 },
];

const domainPatterns = [
  { label: "Simulation numerique", pattern: /\bsimulation\b|\bnumerical simulation\b/gi, score: 8 },
  { label: "Modelisation physique", pattern: /\bphysics\b|\bphysique\b|\bphysical modeling\b/gi, score: 7 },
  { label: "Moteur 3D", pattern: /\b3d engine\b|\bmoteur 3d\b/gi, score: 8 },
  { label: "Calcul scientifique", pattern: /\bscientific computing\b|\bcalcul scientifique\b/gi, score: 7 },
  { label: "HPC", pattern: /\bhpc\b|\bhigh performance computing\b/gi, score: 7 },
  { label: "Graphiques", pattern: /\bgraphics\b|\brendering\b|\brendu\b/gi, score: 6 },
  { label: "Backend", pattern: /\bbackend\b|\bapi\b/gi, score: 5 },
  { label: "Cloud", pattern: /\bcloud\b|\binfra(?:structure)?\b/gi, score: 4 },
  { label: "Data", pattern: /\bdata\b|\banalytics\b/gi, score: 4 },
  { label: "Recherche", pattern: /\bresearch\b|\br&d\b|\brecherche\b/gi, score: 5 },
];

const rolePatterns = [
  { label: "Software Engineer", pattern: /\bsoftware engineer\b/gi, score: 7 },
  { label: "Simulation Engineer", pattern: /\bsimulation engineer\b/gi, score: 8 },
  { label: "R&D Engineer", pattern: /\br&d engineer\b|\bresearch engineer\b/gi, score: 7 },
  { label: "Graphics Programmer", pattern: /\bgraphics programmer\b/gi, score: 8 },
  { label: "Physics Programmer", pattern: /\bphysics programmer\b/gi, score: 8 },
  { label: "Scientific Computing", pattern: /\bscientific computing\b/gi, score: 7 },
];

const keywordPatterns = [
  { label: "Algorithmique", pattern: /\balgorithm(?:s|ique)?\b/gi, score: 4 },
  { label: "Structures de donnees", pattern: /\bdata structure\b|\bstructures? de donnees\b/gi, score: 4 },
  { label: "Temps reel", pattern: /\breal[- ]time\b|\btemps reel\b/gi, score: 5 },
  { label: "Bas niveau", pattern: /\blow[- ]level\b|\bbas niveau\b/gi, score: 5 },
  { label: "Performance", pattern: /\bperformance\b/gi, score: 4 },
  { label: "Mathematiques appliquees", pattern: /\bapplied math(?:ematics)?\b|\bmathematiques appliquees\b/gi, score: 5 },
];

function uniqueList(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string, maxLength = 1200) {
  return normalizeListItem(value).slice(0, maxLength);
}

function inferSignalsFromText(text: string) {
  const results: ExtractionResult["signals"] = [];

  for (const item of technologyPatterns) {
    const matches = text.match(item.pattern)?.length ?? 0;

    if (matches > 0) {
      results.push({
        label: item.label,
        category: "technology",
        score: item.score + Math.min(matches - 1, 3),
      });
    }
  }

  for (const item of domainPatterns) {
    const matches = text.match(item.pattern)?.length ?? 0;

    if (matches > 0) {
      results.push({
        label: item.label,
        category: "domain",
        score: item.score + Math.min(matches - 1, 2),
      });
    }
  }

  for (const item of rolePatterns) {
    const matches = text.match(item.pattern)?.length ?? 0;

    if (matches > 0) {
      results.push({
        label: item.label,
        category: "role",
        score: item.score + Math.min(matches - 1, 2),
      });
    }
  }

  for (const item of keywordPatterns) {
    const matches = text.match(item.pattern)?.length ?? 0;

    if (matches > 0) {
      results.push({
        label: item.label,
        category: "keyword",
        score: item.score + Math.min(matches - 1, 2),
      });
    }
  }

  return results;
}

function mergeSignals(
  entries: Array<{ source: EnrichmentSourceKind; signals: ExtractionResult["signals"] }>,
) {
  const map = new Map<string, ExtractedSignal>();

  for (const entry of entries) {
    for (const signal of entry.signals) {
      const normalizedLabel = slugify(signal.label);
      const key = `${signal.category}:${normalizedLabel}`;
      const existing = map.get(key);

      if (existing) {
        existing.score += signal.score;
        existing.sources = uniqueList([...existing.sources, entry.source]) as EnrichmentSourceKind[];
      } else {
        map.set(key, {
          label: signal.label,
          normalizedLabel,
          category: signal.category,
          score: signal.score,
          sources: [entry.source],
        });
      }
    }
  }

  return Array.from(map.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_SIGNALS);
}

async function fetchUrl(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      "user-agent": DEFAULT_USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url} (${response.status})`);
  }

  return response;
}

async function extractPortfolioSignals(url: string): Promise<ExtractionResult> {
  const response = await fetchUrl(url);
  const html = await response.text();
  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ??
    null;
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    null;
  const text = compactText([title, description, stripTags(html)].filter(Boolean).join(" "));
  const signals = inferSignalsFromText(text.toLowerCase());

  return {
    snapshot: {
      source: "PORTFOLIO",
      url,
      status: "READY",
      title: title ? compactText(title, 160) : null,
      summary: description ? compactText(description, 260) : null,
      fetchedAt: new Date().toISOString(),
      error: null,
      rawSignals: signals.map((item) => item.label),
    },
    text,
    signals,
  };
}

function parseGithubUserName(url: string) {
  try {
    const parsed = new URL(url);
    const [firstSegment] = parsed.pathname.split("/").filter(Boolean);
    return firstSegment || null;
  } catch {
    return null;
  }
}

async function extractGithubSignals(url: string): Promise<ExtractionResult> {
  const userName = parseGithubUserName(url);

  if (!userName) {
    throw new Error("Invalid GitHub URL");
  }

  const [userResponse, reposResponse] = await Promise.all([
    fetchUrl(`https://api.github.com/users/${userName}`),
    fetchUrl(`https://api.github.com/users/${userName}/repos?per_page=${MAX_REPOS}&sort=updated`),
  ]);
  const user = (await userResponse.json()) as {
    login?: string;
    name?: string | null;
    bio?: string | null;
    company?: string | null;
  };
  const repos = (await reposResponse.json()) as Array<{
    name?: string;
    description?: string | null;
    language?: string | null;
    topics?: string[];
    homepage?: string | null;
    archived?: boolean;
    fork?: boolean;
  }>;

  const selectedRepos = repos.filter((repo) => !repo.archived && !repo.fork).slice(0, MAX_REPOS);
  const repoText = selectedRepos
    .map((repo) =>
      [repo.name, repo.description, repo.language, ...(repo.topics ?? []), repo.homepage]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
  const text = compactText(
    [user.login, user.name, user.bio, user.company, repoText].filter(Boolean).join(" "),
    2400,
  );
  const signals = inferSignalsFromText(text.toLowerCase());

  return {
    snapshot: {
      source: "GITHUB",
      url,
      status: "READY",
      title: user.name || user.login || userName,
      summary: user.bio ? compactText(user.bio, 260) : null,
      fetchedAt: new Date().toISOString(),
      error: null,
      rawSignals: signals.map((item) => item.label),
      metadata: {
        repoCount: selectedRepos.length,
        topRepositories: selectedRepos.slice(0, 6).map((repo) => ({
          name: repo.name ?? null,
          language: repo.language ?? null,
          topics: repo.topics ?? [],
        })),
      },
    },
    text,
    signals,
  };
}

async function parsePdfText(buffer: Buffer) {
  const pdfParseModule = (await import("pdf-parse")) as {
    PDFParse: new (input: { data: Buffer }) => {
      getText: () => Promise<{ text?: string | null }>;
      destroy: () => Promise<void>;
    };
  };
  const parser = new pdfParseModule.PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    return parsed.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractResumeSignals(url: string): Promise<ExtractionResult> {
  const response = await fetchUrl(url);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let text = "";

  if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const bytes = Buffer.from(await response.arrayBuffer());
    text = await parsePdfText(bytes);
  } else {
    text = stripTags(await response.text());
  }

  const compactedText = compactText(text, 4000);
  const signals = inferSignalsFromText(compactedText.toLowerCase());

  return {
    snapshot: {
      source: "RESUME",
      url,
      status: "READY",
      title: "CV / Resume",
      summary: compactText(compactedText, 260) || null,
      fetchedAt: new Date().toISOString(),
      error: null,
      rawSignals: signals.map((item) => item.label),
    },
    text: compactedText,
    signals,
  };
}

async function safeExtract(
  source: EnrichmentSourceKind,
  url: string | null | undefined,
  extractor: (url: string) => Promise<ExtractionResult>,
) {
  if (!url) {
    return {
      snapshot: {
        source,
        url: "",
        status: "SKIPPED",
        title: null,
        summary: null,
        fetchedAt: new Date().toISOString(),
        error: null,
        rawSignals: [],
      },
      text: "",
      signals: [],
    } satisfies ExtractionResult;
  }

  try {
    return await extractor(url);
  } catch (error) {
    logServiceError({
      level: "warn",
      scope: "profile/enrichment",
      message: `${source} extraction failed`,
      error,
      metadata: {
        source,
        url,
      },
    });

    return {
      snapshot: {
        source,
        url,
        status: "FAILED",
        title: null,
        summary: null,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown extraction error",
        rawSignals: [],
      },
      text: "",
      signals: [],
    } satisfies ExtractionResult;
  }
}

export async function refreshProfileEnrichment(userId: string) {
  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      fullName: true,
      profile: {
        select: {
          headline: true,
          summary: true,
          linkedinUrl: true,
          githubUrl: true,
          portfolioUrl: true,
          resumeUrl: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  await db.userProfileEnrichment.upsert({
    where: {
      userId,
    },
    update: {
      status: ProfileEnrichmentStatus.PENDING,
      lastError: null,
    },
    create: {
      userId,
      status: ProfileEnrichmentStatus.PENDING,
    },
  });

  const [portfolio, github, resume] = await Promise.all([
    safeExtract("PORTFOLIO", user.profile?.portfolioUrl, extractPortfolioSignals),
    safeExtract("GITHUB", user.profile?.githubUrl, extractGithubSignals),
    safeExtract("RESUME", user.profile?.resumeUrl, extractResumeSignals),
  ]);

  const mergedSignals = mergeSignals([
    { source: "PORTFOLIO", signals: portfolio.signals },
    { source: "GITHUB", signals: github.signals },
    { source: "RESUME", signals: resume.signals },
  ]);
  const failedSources = [portfolio, github, resume].filter(
    (item) => item.snapshot.status === "FAILED",
  );
  const readySources = [portfolio, github, resume].filter(
    (item) => item.snapshot.status === "READY",
  );

  const payload = {
    profileBaseline: {
      fullName: user.fullName,
      headline: user.profile?.headline ?? null,
      summary: user.profile?.summary ?? null,
      linkedinUrl: user.profile?.linkedinUrl ?? null,
      githubUrl: user.profile?.githubUrl ?? null,
      portfolioUrl: user.profile?.portfolioUrl ?? null,
      resumeUrl: user.profile?.resumeUrl ?? null,
    },
    sources: [portfolio.snapshot, github.snapshot, resume.snapshot],
    signals: mergedSignals,
  };
  const sourceSnapshot = {
    sources: payload.sources,
  } as Prisma.InputJsonValue;
  const extractedData = payload as Prisma.InputJsonValue;

  const summary =
    readySources.length > 0
      ? `${mergedSignals.length} signal(aux) internes extraits depuis ${readySources.length} source(s).`
      : "Aucune source externe exploitable pour enrichir le profil.";

  return db.userProfileEnrichment.upsert({
    where: {
      userId,
    },
    update: {
      status:
        mergedSignals.length > 0 || failedSources.length < 3
          ? ProfileEnrichmentStatus.READY
          : ProfileEnrichmentStatus.FAILED,
      sourceSnapshot,
      extractedData,
      summary,
      lastError:
        failedSources.length > 0
          ? failedSources.map((item) => `${item.snapshot.source}: ${item.snapshot.error}`).join(" | ")
          : null,
      lastEnrichedAt: new Date(),
    },
    create: {
      userId,
      status:
        mergedSignals.length > 0 || failedSources.length < 3
          ? ProfileEnrichmentStatus.READY
          : ProfileEnrichmentStatus.FAILED,
      sourceSnapshot,
      extractedData,
      summary,
      lastError:
        failedSources.length > 0
          ? failedSources.map((item) => `${item.snapshot.source}: ${item.snapshot.error}`).join(" | ")
          : null,
      lastEnrichedAt: new Date(),
    },
  });
}
