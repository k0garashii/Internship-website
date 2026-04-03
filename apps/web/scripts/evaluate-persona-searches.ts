import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildPersonaEmail,
  buildPersonaFullName,
  testPersonas,
  type TestPersona,
  personaSeedPassword,
} from "../src/lib/testing/personas";

type SearchPlanResponse = {
  summary?: string;
  queries?: Array<{
    label?: string;
    targetRole?: string;
    domain?: string | null;
    location?: string | null;
    focusKeywords?: string[];
    queryText?: string;
  }>;
  error?: string;
};

type CompanyTargetsResponse = {
  provider?: string;
  summary?: string;
  suggestions?: Array<{
    companyName?: string;
    rationale?: string;
    matchedSignals?: string[];
    tags?: string[];
  }>;
  error?: string;
};

type SearchDiscoveryOffer = {
  title?: string;
  companyName?: string;
  locationLabel?: string | null;
  sourceUrl?: string;
  matchedKeywords?: string[];
  matchedQueryLabels?: string[];
  relevanceScore?: number;
  relevanceLabel?: string;
  contractType?: string | null;
  remoteMode?: string | null;
  matching?: {
    score?: number;
    label?: string;
    summary?: string;
    breakdown?: Array<{
      criterion?: string;
      matchedTerms?: string[];
    }>;
  };
};

type SearchDiscoveryResponse = {
  summary?: string;
  offerCount?: number;
  offers?: SearchDiscoveryOffer[];
  queryExecutions?: Array<{
    label?: string;
    totalHits?: number;
    returnedHits?: number;
    queryText?: string;
  }>;
  warnings?: string[];
  error?: string;
};

type InferenceResponse = {
  eventCount?: number;
  snapshot?: {
    inferred?: Array<{
      axis?: string;
      value?: string;
      score?: number;
      confidence?: string;
    }>;
  } | null;
  diagnostics?: {
    eventCount?: number;
    implicitSignalSummary?: {
      dwellQualifiedOpenCount?: number;
      companyExplorationCount?: number;
      positiveImplicitSignalCount?: number;
    };
    convergence?: {
      evaluatedRunCount?: number;
      firstRunAverageTopScore?: number | null;
      latestRunAverageTopScore?: number | null;
      averageTopScoreDelta?: number;
      recentRuns?: Array<{
        runId?: string;
        label?: string;
        averageTopScore?: number | null;
        relevantShare?: number | null;
      }>;
    };
  } | null;
  error?: string;
};

type PersonaSearchSnapshot = {
  companySuggestionCount: number;
  favoriteCompanyHits: string[];
  offerCount: number;
  averageRelevanceScore: number | null;
  topOffers: Array<{
    title: string;
    companyName: string;
    locationLabel: string | null;
    relevanceLabel: string | null;
    relevanceScore: number | null;
    alignmentSignals: string[];
  }>;
  verificationMatches: Array<{
    label: string;
    matched: boolean;
    hits: string[];
  }>;
};

type PersonaLearningRound = {
  round: number;
  snapshot: PersonaSearchSnapshot;
  inferenceEventCount: number;
  inferredPreferenceCount: number;
  convergenceDelta: number | null;
};

type PersonaEvaluation = {
  slug: string;
  fullName: string;
  sector: string;
  preferredSubsector: string;
  personality: string;
  favoriteCompanies: string[];
  status: "ok" | "warning" | "error";
  issues: string[];
  plan: {
    queryCount: number;
    sampleQueries: string[];
  };
  baseline: PersonaSearchSnapshot;
  rounds: PersonaLearningRound[];
  outcome: {
    favoriteCompanyDelta: number;
    verificationDelta: number;
    averageScoreDelta: number;
    convergenceDelta: number | null;
    eventCount: number;
  };
};

type EvaluationReport = {
  generatedAt: string;
  baseUrl: string;
  personaCount: number;
  summary: {
    ok: number;
    warning: number;
    error: number;
  };
  evaluations: PersonaEvaluation[];
};

function getBaseUrl() {
  return process.env.PERSONA_EVAL_BASE_URL?.trim() || "http://127.0.0.1:3210";
}

async function ensureOk(response: Response) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.url} failed (${response.status}): ${body.slice(0, 600)}`);
  }
}

function extractCookie(setCookieHeader: string | null) {
  if (!setCookieHeader) {
    throw new Error("No session cookie returned by sign-in");
  }

  return (
    setCookieHeader
      .split(",")
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith("internship_session="))
      ?.split(";")[0] ?? setCookieHeader.split(";")[0]
  );
}

async function signIn(baseUrl: string, email: string) {
  const response = await fetch(`${baseUrl}/api/auth/sign-in`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: personaSeedPassword,
    }),
    redirect: "manual",
  });

  await ensureOk(response);
  return extractCookie(response.headers.get("set-cookie"));
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  cookie: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(120000),
    headers: {
      cookie,
      ...(init?.headers ?? {}),
    },
  });

  await ensureOk(response);
  return (await response.json()) as T;
}

async function postJson<T>(
  baseUrl: string,
  path: string,
  cookie: string,
  payload: unknown,
): Promise<T> {
  return requestJson<T>(baseUrl, path, cookie, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildSignalLexicon(persona: TestPersona) {
  return Array.from(
    new Set(
      [
        persona.searchSector,
        persona.preferredSubsector,
        ...persona.targetRoles,
        ...persona.searchKeywords,
        ...persona.applicationDomains,
        ...persona.hardSkills,
        ...persona.favoriteCompanies.map((company) => company.name),
        ...persona.preferredDomains.map((domain) => domain.label),
      ]
        .flatMap((value) => normalizeText(value).split(/[^a-z0-9]+/))
        .map((token) => token.trim())
        .filter((token) => token.length >= 4),
    ),
  );
}

function collectOfferSignalMatches(persona: TestPersona, offer: SearchDiscoveryOffer) {
  const lexicon = buildSignalLexicon(persona);
  const haystack = normalizeText(
    [
      offer.title ?? "",
      offer.companyName ?? "",
      ...(offer.matchedKeywords ?? []),
      ...(offer.matchedQueryLabels ?? []),
      offer.matching?.summary ?? "",
      ...(offer.matching?.breakdown ?? []).flatMap((item) => item.matchedTerms ?? []),
    ].join(" "),
  );

  return lexicon.filter((token) => haystack.includes(token)).slice(0, 10);
}

function buildFavoriteCompanyHits(
  persona: TestPersona,
  companyTargets: CompanyTargetsResponse,
  discovery: SearchDiscoveryResponse,
) {
  const favoriteNames = persona.favoriteCompanies.map((company) => normalizeText(company.name));
  const companyHaystack = [
    ...(companyTargets.suggestions ?? []).map((item) => item.companyName ?? ""),
    ...(discovery.offers ?? []).map((offer) => offer.companyName ?? ""),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return persona.favoriteCompanies
    .map((company) => company.name)
    .filter((companyName) =>
      companyHaystack.some((item) => item.includes(normalizeText(companyName))),
    );
}

function buildVerificationMatches(
  persona: TestPersona,
  companyTargets: CompanyTargetsResponse,
  discovery: SearchDiscoveryResponse,
) {
  const companyText = normalizeText(
    (companyTargets.suggestions ?? [])
      .flatMap((suggestion) => [
        suggestion.companyName ?? "",
        suggestion.rationale ?? "",
        ...(suggestion.tags ?? []),
        ...(suggestion.matchedSignals ?? []),
      ])
      .join(" "),
  );
  const offersText = normalizeText(
    (discovery.offers ?? [])
      .flatMap((offer) => [
        offer.title ?? "",
        offer.companyName ?? "",
        ...(offer.matchedKeywords ?? []),
        ...(offer.matchedQueryLabels ?? []),
        offer.matching?.summary ?? "",
      ])
      .join(" "),
  );

  return persona.verificationChecklist.map((criterion) => {
    const hits = criterion.expectedSignals.filter((signal) => {
      const normalized = normalizeText(signal);
      return companyText.includes(normalized) || offersText.includes(normalized);
    });

    return {
      label: criterion.label,
      matched: hits.length > 0,
      hits,
    };
  });
}

function buildSnapshot(
  persona: TestPersona,
  companyTargets: CompanyTargetsResponse,
  discovery: SearchDiscoveryResponse,
): PersonaSearchSnapshot {
  const topOffers = (discovery.offers ?? []).slice(0, 5).map((offer) => ({
    title: offer.title ?? "Sans titre",
    companyName: offer.companyName ?? "Entreprise inconnue",
    locationLabel: offer.locationLabel ?? null,
    relevanceLabel: offer.relevanceLabel ?? offer.matching?.label ?? null,
    relevanceScore: offer.relevanceScore ?? offer.matching?.score ?? null,
    alignmentSignals: collectOfferSignalMatches(persona, offer),
  }));
  const relevanceScores = topOffers
    .map((offer) => offer.relevanceScore)
    .filter((value): value is number => typeof value === "number");

  return {
    companySuggestionCount: companyTargets.suggestions?.length ?? 0,
    favoriteCompanyHits: buildFavoriteCompanyHits(persona, companyTargets, discovery),
    offerCount: discovery.offerCount ?? 0,
    averageRelevanceScore:
      relevanceScores.length > 0
        ? Number(
            (
              relevanceScores.reduce((sum, value) => sum + value, 0) / relevanceScores.length
            ).toFixed(1),
          )
        : null,
    topOffers,
    verificationMatches: buildVerificationMatches(persona, companyTargets, discovery),
  };
}

function countSatisfiedVerificationCriteria(snapshot: PersonaSearchSnapshot) {
  return snapshot.verificationMatches.filter((criterion) => criterion.matched).length;
}

function rankOfferForInteraction(persona: TestPersona, offer: SearchDiscoveryOffer) {
  const alignmentSignals = collectOfferSignalMatches(persona, offer);
  const favoriteCompanyBoost = persona.favoriteCompanies.some((company) =>
    normalizeText(offer.companyName ?? "").includes(normalizeText(company.name)),
  )
    ? 4
    : 0;
  const score = alignmentSignals.length * 2 + (offer.relevanceScore ?? offer.matching?.score ?? 0) / 20 + favoriteCompanyBoost;

  return {
    offer,
    score,
  };
}

async function simulateImplicitLearning(
  baseUrl: string,
  cookie: string,
  persona: TestPersona,
  companyTargets: CompanyTargetsResponse,
  discovery: SearchDiscoveryResponse,
  round: number,
) {
  const offers = (discovery.offers ?? [])
    .slice()
    .map((offer) => rankOfferForInteraction(persona, offer))
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((item) => item.offer);
  const interestingCompanies = (companyTargets.suggestions ?? [])
    .slice()
    .sort((left, right) => {
      const leftFavorite = persona.favoriteCompanies.some((company) =>
        normalizeText(left.companyName ?? "").includes(normalizeText(company.name)),
      );
      const rightFavorite = persona.favoriteCompanies.some((company) =>
        normalizeText(right.companyName ?? "").includes(normalizeText(company.name)),
      );

      if (leftFavorite === rightFavorite) {
        return 0;
      }

      return leftFavorite ? -1 : 1;
    })
    .slice(0, 2);

  for (const offer of offers) {
    await postJson(
      baseUrl,
      "/api/search/interactions",
      cookie,
      {
        type: "SEARCH_RESULT_OPENED",
        sourceUrl: offer.sourceUrl ?? null,
        offerContext: {
          title: offer.title ?? "Sans titre",
          companyName: offer.companyName ?? "Entreprise inconnue",
          locationLabel: offer.locationLabel ?? null,
          employmentType: offer.contractType ?? null,
          workMode: offer.remoteMode ?? null,
          matchedQueryLabels: offer.matchedQueryLabels ?? [],
          matchedKeywords: offer.matchedKeywords ?? [],
        },
        metadata: {
          ctaKind: "persona_evaluation_open",
          round,
        },
      },
    );

    await postJson(
      baseUrl,
      "/api/search/interactions",
      cookie,
      {
        type: "SEARCH_RESULT_EXPANDED",
        sourceUrl: offer.sourceUrl ?? null,
        dedupeKey: `${persona.slug}:offer:${offer.companyName}:${offer.title}:${round}`,
        offerContext: {
          title: offer.title ?? "Sans titre",
          companyName: offer.companyName ?? "Entreprise inconnue",
          locationLabel: offer.locationLabel ?? null,
          employmentType: offer.contractType ?? null,
          workMode: offer.remoteMode ?? null,
          matchedQueryLabels: offer.matchedQueryLabels ?? [],
          matchedKeywords: offer.matchedKeywords ?? [],
        },
        metadata: {
          dwellMs: 26000 + round * 3000,
          ctaKind: "persona_evaluation_dwell",
          round,
        },
      },
    );
  }

  for (const company of interestingCompanies) {
    await postJson(
      baseUrl,
      "/api/search/interactions",
      cookie,
      {
        type: "COMPANY_TARGET_OPENED",
        companyName: company.companyName ?? null,
        companyContext: {
          companyName: company.companyName ?? "Entreprise inconnue",
          matchedSignals: company.matchedSignals ?? [],
          tags: company.tags ?? [],
        },
        metadata: {
          ctaKind: "persona_evaluation_company",
          round,
        },
      },
    );
  }
}

function buildIssues(
  persona: TestPersona,
  baseline: PersonaSearchSnapshot,
  rounds: PersonaLearningRound[],
) {
  const issues: string[] = [];
  const lastRound = rounds.at(-1);

  if (baseline.offerCount === 0) {
    issues.push("Aucune offre n a ete remontee au baseline.");
  }

  if (baseline.companySuggestionCount === 0) {
    issues.push("Aucune entreprise cible n a ete suggeree au baseline.");
  }

  if (!lastRound) {
    issues.push("La boucle d apprentissage n a produit aucun round mesurable.");
    return issues;
  }

  if ((lastRound.snapshot.averageRelevanceScore ?? 0) < (baseline.averageRelevanceScore ?? 0)) {
    issues.push("Le score moyen des offres a baisse apres apprentissage.");
  }

  if (
    countSatisfiedVerificationCriteria(lastRound.snapshot) <
    countSatisfiedVerificationCriteria(baseline)
  ) {
    issues.push("Moins de criteres de verification sont satisfaits apres apprentissage.");
  }

  if (
    lastRound.snapshot.favoriteCompanyHits.length < baseline.favoriteCompanyHits.length &&
    persona.favoriteCompanies.length > 0
  ) {
    issues.push("Les entreprises favorites du persona remontent moins apres apprentissage.");
  }

  return issues;
}

async function evaluatePersona(baseUrl: string, persona: TestPersona): Promise<PersonaEvaluation> {
  console.log(`[persona] ${persona.slug}: baseline`);
  const email = buildPersonaEmail(persona);
  const cookie = await signIn(baseUrl, email);
  const plan = await requestJson<SearchPlanResponse>(baseUrl, "/api/search/plan", cookie);
  const baselineCompanyTargets = await postJson<CompanyTargetsResponse>(
    baseUrl,
    "/api/profile/company-targets",
    cookie,
    {},
  );
  const baselineDiscovery = await postJson<SearchDiscoveryResponse>(
    baseUrl,
    "/api/search/discovery",
    cookie,
    {},
  );
  const baseline = buildSnapshot(persona, baselineCompanyTargets, baselineDiscovery);

  const rounds: PersonaLearningRound[] = [];
  let latestCompanyTargets = baselineCompanyTargets;
  let latestDiscovery = baselineDiscovery;

  for (const round of [1, 2]) {
    console.log(`[persona] ${persona.slug}: round ${round} interactions`);
    await simulateImplicitLearning(
      baseUrl,
      cookie,
      persona,
      latestCompanyTargets,
      latestDiscovery,
      round,
    );
    latestCompanyTargets = await postJson<CompanyTargetsResponse>(
      baseUrl,
      "/api/profile/company-targets",
      cookie,
      {},
    );
    latestDiscovery = await postJson<SearchDiscoveryResponse>(
      baseUrl,
      "/api/search/discovery",
      cookie,
      {},
    );
    const inference = await requestJson<InferenceResponse>(
      baseUrl,
      "/api/profile/inference",
      cookie,
    );
    console.log(`[persona] ${persona.slug}: round ${round} evaluated`);
    const snapshot = buildSnapshot(persona, latestCompanyTargets, latestDiscovery);

    rounds.push({
      round,
      snapshot,
      inferenceEventCount: inference.eventCount ?? inference.diagnostics?.eventCount ?? 0,
      inferredPreferenceCount: inference.snapshot?.inferred?.length ?? 0,
      convergenceDelta: inference.diagnostics?.convergence?.averageTopScoreDelta ?? null,
    });
  }

  const issues = buildIssues(persona, baseline, rounds);
  const finalRound = rounds.at(-1);
  const status =
    issues.some((issue) => issue.includes("Aucune offre")) ? "error" : issues.length > 0 ? "warning" : "ok";

  return {
    slug: persona.slug,
    fullName: buildPersonaFullName(persona),
    sector: persona.searchSector,
    preferredSubsector: persona.preferredSubsector,
    personality: persona.personality,
    favoriteCompanies: persona.favoriteCompanies.map((company) => company.name),
    status,
    issues,
    plan: {
      queryCount: plan.queries?.length ?? 0,
      sampleQueries: (plan.queries ?? [])
        .slice(0, 4)
        .map((query) => query.queryText ?? query.label ?? "Sans requete"),
    },
    baseline,
    rounds,
    outcome: {
      favoriteCompanyDelta:
        (finalRound?.snapshot.favoriteCompanyHits.length ?? 0) - baseline.favoriteCompanyHits.length,
      verificationDelta:
        (finalRound ? countSatisfiedVerificationCriteria(finalRound.snapshot) : 0) -
        countSatisfiedVerificationCriteria(baseline),
      averageScoreDelta:
        (finalRound?.snapshot.averageRelevanceScore ?? 0) - (baseline.averageRelevanceScore ?? 0),
      convergenceDelta: finalRound?.convergenceDelta ?? null,
      eventCount: finalRound?.inferenceEventCount ?? 0,
    },
  };
}

function toMarkdown(report: EvaluationReport) {
  const lines = [
    "# Evaluation multi-personas avec apprentissage implicite",
    "",
    `Genere le ${report.generatedAt}`,
    "",
    `Base URL: ${report.baseUrl}`,
    "",
    `Synthese: ${report.summary.ok} ok, ${report.summary.warning} warning, ${report.summary.error} error.`,
    "",
  ];

  for (const evaluation of report.evaluations) {
    lines.push(`## ${evaluation.fullName} - ${evaluation.sector}`);
    lines.push(`- Sous-secteur: ${evaluation.preferredSubsector}`);
    lines.push(`- Personnalite: ${evaluation.personality}`);
    lines.push(`- Entreprises favorites: ${evaluation.favoriteCompanies.join(", ")}`);
    lines.push(`- Statut: ${evaluation.status}`);
    lines.push(`- Plan: ${evaluation.plan.queryCount} requetes`);
    lines.push(
      `- Baseline: ${evaluation.baseline.offerCount} offres | score moyen ${evaluation.baseline.averageRelevanceScore ?? "n/a"} | favorites trouvees ${evaluation.baseline.favoriteCompanyHits.join(", ") || "aucune"}`,
    );
    for (const round of evaluation.rounds) {
      lines.push(
        `- Round ${round.round}: ${round.snapshot.offerCount} offres | score moyen ${round.snapshot.averageRelevanceScore ?? "n/a"} | verification ${countSatisfiedVerificationCriteria(round.snapshot)}/${round.snapshot.verificationMatches.length} | convergence ${round.convergenceDelta ?? "n/a"}`,
      );
    }
    lines.push(
      `- Outcome: delta score ${evaluation.outcome.averageScoreDelta.toFixed(1)} | delta verification ${evaluation.outcome.verificationDelta} | delta favorites ${evaluation.outcome.favoriteCompanyDelta}`,
    );
    if (evaluation.issues.length > 0) {
      lines.push(`- Points d attention: ${evaluation.issues.join(" / ")}`);
    }
    for (const offer of evaluation.rounds.at(-1)?.snapshot.topOffers.slice(0, 3) ?? []) {
      lines.push(
        `- Offre finale: ${offer.title} | ${offer.companyName} | ${offer.locationLabel ?? "lieu inconnu"} | ${offer.relevanceLabel ?? "sans label"} | signaux: ${offer.alignmentSignals.join(", ") || "aucun"}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const baseUrl = getBaseUrl();
  const evaluations: PersonaEvaluation[] = [];

  for (const persona of testPersonas) {
    console.log(`[persona] start ${persona.slug}`);
    evaluations.push(await evaluatePersona(baseUrl, persona));
    console.log(`[persona] done ${persona.slug}`);
  }

  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    personaCount: evaluations.length,
    summary: {
      ok: evaluations.filter((evaluation) => evaluation.status === "ok").length,
      warning: evaluations.filter((evaluation) => evaluation.status === "warning").length,
      error: evaluations.filter((evaluation) => evaluation.status === "error").length,
    },
    evaluations,
  };

  const outputDir = resolve(".codex-artifacts", "persona-evaluation");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = resolve(outputDir, "report.json");
  const markdownPath = resolve(outputDir, "report.md");
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(markdownPath, toMarkdown(report), "utf8");

  console.log(
    JSON.stringify(
      {
        jsonPath,
        markdownPath,
        summary: report.summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
