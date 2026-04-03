import { normalizeListItem, splitMultilineOrCommaList, type ProfileOnboardingData } from "@/lib/profile/schema";
import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { SearchTargetsFile } from "@/lib/config/search-targets";

export const searchPreferenceAxes = [
  "ROLE",
  "DOMAIN",
  "KEYWORD",
  "TECHNOLOGY",
  "LOCATION",
  "WORK_MODE",
  "EMPLOYMENT_TYPE",
  "COMPANY",
  "COMPANY_TYPE",
  "OUTCOME",
] as const;

export type SearchPreferenceAxis = (typeof searchPreferenceAxes)[number];

export const searchPreferencePolarities = ["POSITIVE", "NEGATIVE"] as const;
export type SearchPreferencePolarity = (typeof searchPreferencePolarities)[number];

export const searchPreferenceConfidences = ["LOW", "MEDIUM", "HIGH"] as const;
export type SearchPreferenceConfidence = (typeof searchPreferenceConfidences)[number];

export const searchProfileSignalSources = [
  "ONBOARDING",
  "PROFILE_EDIT",
  "PROFILE_ENRICHMENT",
  "SEARCH_EXECUTED",
  "SEARCH_QUERY",
  "SEARCH_PLAN_VIEWED",
  "SEARCH_RESULT_OPENED",
  "COMPANY_TARGET_OPENED",
  "ATS_SOURCE_OPENED",
  "OFFER_FEEDBACK",
  "OFFER_DELETED",
  "OFFER_SHORTLISTED",
  "DRAFT_GENERATED",
  "EMAIL_SENT",
  "EMAIL_REPLY_RECEIVED",
  "APPLICATION_OUTCOME",
] as const;
export type SearchProfileSignalSource = (typeof searchProfileSignalSources)[number];

export type SearchPersonalizationGuardrail = {
  axis: SearchPreferenceAxis;
  mode:
    | "LOCK_EXPLICIT"
    | "BOOST_ONLY"
    | "ALLOW_EXPLORATION"
    | "REQUIRES_CONFIRMATION"
    | "NEGATIVE_ONLY_WITH_STRONG_SIGNAL";
  rationale: string;
};

export type DeclaredSearchProfileSnapshot = {
  targetRoles: string[];
  preferredDomains: string[];
  preferredKeywords: string[];
  preferredTechnologies: string[];
  preferredLocations: string[];
  employmentTypes: string[];
  workModes: string[];
  hardConstraints: {
    availabilityDate: string | null;
    availabilityEndDate: string | null;
    needsSponsorship: boolean;
  };
  evidence: {
    profileSkills: string[];
    enrichmentTechnologies: string[];
    enrichmentDomains: string[];
    enrichmentRoles: string[];
    enrichmentKeywords: string[];
  };
};

export type InferredSearchPreference = {
  axis: SearchPreferenceAxis;
  value: string;
  polarity: SearchPreferencePolarity;
  score: number;
  confidence: SearchPreferenceConfidence;
  sources: SearchProfileSignalSource[];
  supportingEventCount: number;
  lastObservedAt: string | null;
  reason: string | null;
};

export type SearchPersonalizationSnapshot = {
  declared: DeclaredSearchProfileSnapshot;
  inferred: InferredSearchPreference[];
  guardrails: SearchPersonalizationGuardrail[];
};

export type SearchPersonalizationImpactMetrics = {
  comparedOfferCount: number;
  personalizedWins: number;
  unchangedCount: number;
  explicitWins: number;
  averageScoreDelta: number;
  topBoostedOffers: Array<{
    offerId: string;
    title: string;
    companyName: string;
    explicitScore: number;
    personalizedScore: number;
    delta: number;
  }>;
};

export type SearchPersonalizationConvergenceMetrics = {
  evaluatedRunCount: number;
  firstRunAverageTopScore: number | null;
  latestRunAverageTopScore: number | null;
  averageTopScoreDelta: number;
  firstRelevantShare: number | null;
  latestRelevantShare: number | null;
  relevantShareDelta: number | null;
  recentRuns: Array<{
    runId: string;
    label: string;
    createdAt: string;
    averageTopScore: number | null;
    relevantShare: number | null;
    resultCount: number;
  }>;
};

export type SearchPersonalizationDiagnostics = {
  eventCount: number;
  lastEventAt: string | null;
  eventTypeCounts: Record<string, number>;
  effectiveInferredPreferences: InferredSearchPreference[];
  guardrailSummary: Array<{
    axis: SearchPreferenceAxis;
    mode: SearchPersonalizationGuardrail["mode"];
  }>;
  impact: SearchPersonalizationImpactMetrics;
  implicitSignalSummary: {
    engagementEventCount: number;
    dwellQualifiedOpenCount: number;
    companyExplorationCount: number;
    positiveImplicitSignalCount: number;
  };
  convergence: SearchPersonalizationConvergenceMetrics;
};

type EnrichmentSignalCategory = "technology" | "domain" | "keyword" | "role";

type EnrichmentSignalRecord = {
  label?: unknown;
  category?: unknown;
};

export const defaultSearchPersonalizationGuardrails: SearchPersonalizationGuardrail[] = [
  {
    axis: "EMPLOYMENT_TYPE",
    mode: "LOCK_EXPLICIT",
    rationale: "Le type de contrat reste une contrainte declaree et ne doit pas etre deduit.",
  },
  {
    axis: "LOCATION",
    mode: "LOCK_EXPLICIT",
    rationale: "Les zones de recherche ne doivent pas etre elargies sans validation explicite.",
  },
  {
    axis: "WORK_MODE",
    mode: "LOCK_EXPLICIT",
    rationale: "Le mode remote / hybride / onsite reste pilote par le profil declare.",
  },
  {
    axis: "ROLE",
    mode: "BOOST_ONLY",
    rationale: "Les roles infers peuvent reprioriser, mais pas remplacer la cible explicite.",
  },
  {
    axis: "DOMAIN",
    mode: "BOOST_ONLY",
    rationale: "Les domaines observes servent a pousser certaines offres sans masquer les choix declares.",
  },
  {
    axis: "KEYWORD",
    mode: "ALLOW_EXPLORATION",
    rationale: "Les mots-cles peuvent ouvrir des variantes proches tant qu ils ne contredisent pas les contraintes.",
  },
  {
    axis: "TECHNOLOGY",
    mode: "ALLOW_EXPLORATION",
    rationale: "Les technos observees servent surtout a raffiner le matching technique.",
  },
  {
    axis: "COMPANY",
    mode: "ALLOW_EXPLORATION",
    rationale: "Les interactions avec certaines entreprises peuvent guider la collecte sans figer la recherche.",
  },
  {
    axis: "COMPANY_TYPE",
    mode: "REQUIRES_CONFIRMATION",
    rationale: "Les preferences sur le type d entreprise peuvent etre suggerees mais pas imposees.",
  },
  {
    axis: "OUTCOME",
    mode: "NEGATIVE_ONLY_WITH_STRONG_SIGNAL",
    rationale: "Les resultats reels sont forts, mais les deductions negatives demandent un signal robuste.",
  },
];

function uniqueNormalizedList(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeListItem(value))
        .filter(Boolean),
    ),
  );
}

export function normalizePersonalizationValue(value: string) {
  return normalizeListItem(value);
}

function isEnrichmentSignalCategory(value: unknown): value is EnrichmentSignalCategory {
  return value === "technology" || value === "domain" || value === "keyword" || value === "role";
}

function readEnrichmentSignalsByCategory(
  enrichmentData: unknown,
  category: EnrichmentSignalCategory,
) {
  if (
    typeof enrichmentData !== "object" ||
    enrichmentData === null ||
    !("signals" in enrichmentData) ||
    !Array.isArray((enrichmentData as { signals?: unknown }).signals)
  ) {
    return [];
  }

  return ((enrichmentData as { signals: unknown[] }).signals as unknown[])
    .filter((item): item is EnrichmentSignalRecord => typeof item === "object" && item !== null)
    .filter((item) => isEnrichmentSignalCategory(item.category) && item.category === category)
    .map((item) => (typeof item.label === "string" ? item.label : ""))
    .filter(Boolean)
    .map((item) => normalizeListItem(item))
    .filter(Boolean);
}

export function buildDeclaredSearchProfileSnapshot(
  profile: ProfileOnboardingData,
  options?: {
    enrichmentData?: unknown;
  },
): DeclaredSearchProfileSnapshot {
  const domainSelections = (profile.domainSelections ?? [])
    .filter((item) => item.isValidated)
    .map((item) => item.label);
  const enrichedTechnologies = readEnrichmentSignalsByCategory(
    options?.enrichmentData,
    "technology",
  );
  const enrichedDomains = readEnrichmentSignalsByCategory(options?.enrichmentData, "domain");
  const enrichedRoles = readEnrichmentSignalsByCategory(options?.enrichmentData, "role");
  const enrichedKeywords = readEnrichmentSignalsByCategory(options?.enrichmentData, "keyword");

  return {
    targetRoles: uniqueNormalizedList(splitMultilineOrCommaList(profile.targetRoles)),
    preferredDomains: uniqueNormalizedList([
      ...domainSelections,
      ...splitMultilineOrCommaList(profile.preferredDomains),
    ]),
    preferredKeywords: uniqueNormalizedList(splitMultilineOrCommaList(profile.searchKeywords)),
    preferredTechnologies: uniqueNormalizedList(splitMultilineOrCommaList(profile.skills)),
    preferredLocations: uniqueNormalizedList(splitMultilineOrCommaList(profile.preferredLocations)),
    employmentTypes: [...profile.employmentTypes],
    workModes: profile.remotePreference ? [profile.remotePreference] : [],
    hardConstraints: {
      availabilityDate: profile.availabilityDate || null,
      availabilityEndDate: profile.availabilityEndDate || null,
      needsSponsorship: profile.visaNeedsSponsorship,
    },
    evidence: {
      profileSkills: uniqueNormalizedList(splitMultilineOrCommaList(profile.skills)),
      enrichmentTechnologies: uniqueNormalizedList(enrichedTechnologies),
      enrichmentDomains: uniqueNormalizedList(enrichedDomains),
      enrichmentRoles: uniqueNormalizedList(enrichedRoles),
      enrichmentKeywords: uniqueNormalizedList(enrichedKeywords),
    },
  };
}

export function buildDeclaredSearchProfileSnapshotFromFiles(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
  options?: {
    enrichmentData?: unknown;
  },
): DeclaredSearchProfileSnapshot {
  const enrichedTechnologies = readEnrichmentSignalsByCategory(
    options?.enrichmentData,
    "technology",
  );
  const enrichedDomains = readEnrichmentSignalsByCategory(options?.enrichmentData, "domain");
  const enrichedRoles = readEnrichmentSignalsByCategory(options?.enrichmentData, "role");
  const enrichedKeywords = readEnrichmentSignalsByCategory(options?.enrichmentData, "keyword");

  return {
    targetRoles: uniqueNormalizedList(searchTargets.targets.map((target) => target.title)),
    preferredDomains: uniqueNormalizedList(
      searchTargets.preferredDomains.map((domain) => domain.label),
    ),
    preferredKeywords: uniqueNormalizedList(searchTargets.keywords),
    preferredTechnologies: uniqueNormalizedList(personalProfile.profile.skills),
    preferredLocations: uniqueNormalizedList(
      searchTargets.preferredLocations.map((location) => location.label),
    ),
    employmentTypes: Array.from(
      new Set(searchTargets.targets.flatMap((target) => target.employmentTypes)),
    ),
    workModes: personalProfile.profile.remotePreference
      ? [personalProfile.profile.remotePreference]
      : [],
    hardConstraints: {
      availabilityDate: personalProfile.profile.availabilityDate,
      availabilityEndDate: personalProfile.profile.constraints.availabilityEndDate,
      needsSponsorship: personalProfile.profile.constraints.visaNeedsSponsorship,
    },
    evidence: {
      profileSkills: uniqueNormalizedList(personalProfile.profile.skills),
      enrichmentTechnologies: uniqueNormalizedList(enrichedTechnologies),
      enrichmentDomains: uniqueNormalizedList(enrichedDomains),
      enrichmentRoles: uniqueNormalizedList(enrichedRoles),
      enrichmentKeywords: uniqueNormalizedList(enrichedKeywords),
    },
  };
}

export function getSearchPersonalizationGuardrail(
  axis: SearchPreferenceAxis,
  guardrails: SearchPersonalizationGuardrail[] = defaultSearchPersonalizationGuardrails,
) {
  return (
    guardrails.find((guardrail) => guardrail.axis === axis) ?? {
      axis,
      mode: "ALLOW_EXPLORATION" as const,
      rationale: "Aucun garde-fou specifique, exploration autorisee.",
    }
  );
}

export function selectEffectiveInferredPreferences(
  inferred: InferredSearchPreference[],
  guardrails: SearchPersonalizationGuardrail[] = defaultSearchPersonalizationGuardrails,
) {
  return inferred.filter((preference) => {
    const guardrail = getSearchPersonalizationGuardrail(preference.axis, guardrails);

    switch (guardrail.mode) {
      case "LOCK_EXPLICIT":
        return false;
      case "BOOST_ONLY":
        return preference.polarity === "POSITIVE";
      case "REQUIRES_CONFIRMATION":
        return preference.polarity === "POSITIVE" && preference.confidence === "HIGH";
      case "NEGATIVE_ONLY_WITH_STRONG_SIGNAL":
        if (preference.polarity === "POSITIVE") {
          return true;
        }

        return preference.confidence === "HIGH" && preference.supportingEventCount >= 2;
      case "ALLOW_EXPLORATION":
      default:
        return true;
    }
  });
}
