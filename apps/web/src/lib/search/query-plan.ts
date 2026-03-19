import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
import { normalizeListItem, slugify } from "@/lib/profile/schema";

export type SearchQueryCandidate = {
  id: string;
  label: string;
  queryText: string;
  targetRole: string;
  domain: string | null;
  location: string | null;
  keywords: string[];
  focusKeywords: string[];
  priority: number;
  explanation: string;
};

export type SearchQueryPlan = {
  generatedAt: string;
  summary: string;
  inputs: {
    targetRoles: string[];
    domains: string[];
    locations: string[];
    keywords: string[];
  };
  strategy: string[];
  queries: SearchQueryCandidate[];
};

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => (value ? normalizeListItem(value) : "")).filter(Boolean)),
  );
}

function rotateList<T>(values: T[], offset: number) {
  if (values.length === 0) {
    return [];
  }

  const normalizedOffset = ((offset % values.length) + values.length) % values.length;

  return [...values.slice(normalizedOffset), ...values.slice(0, normalizedOffset)];
}

function tokenizeForMatch(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  const slugTokens = slugify(value).split("-").filter(Boolean);
  const rawTokens = value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .map((token) => token.trim())
    .filter(Boolean);

  return uniqueList([...slugTokens, ...rawTokens]);
}

function fallbackTargetRoles(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  const explicitTargets = uniqueList(
    searchTargets.targets.filter((target) => target.isActive).map((target) => target.title),
  );

  if (explicitTargets.length > 0) {
    return explicitTargets;
  }

  return uniqueList([
    personalProfile.profile.headline ?? "",
    personalProfile.profile.experienceLevel
      ? `${personalProfile.profile.experienceLevel} software engineer`
      : "",
    "Software engineer",
  ]);
}

function fallbackDomains(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  const explicitDomains = uniqueList(
    searchTargets.preferredDomains.map((domain) => domain.label),
  );

  if (explicitDomains.length > 0) {
    return explicitDomains;
  }

  return uniqueList([
    ...personalProfile.profile.skills.slice(0, 6),
    personalProfile.profile.headline ?? "",
  ]).slice(0, 6);
}

function fallbackLocations(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  const explicitLocations = uniqueList(
    searchTargets.preferredLocations.map((location) => {
      if (location.label) {
        return location.label;
      }

      if (location.isRemote) {
        return "Remote";
      }

      if (location.isHybrid) {
        return "Hybride";
      }

      return "";
    }),
  );

  if (explicitLocations.length > 0) {
    return explicitLocations;
  }

  return uniqueList([
    personalProfile.profile.city ?? "",
    personalProfile.profile.countryCode === "FR"
      ? "France"
      : personalProfile.profile.countryCode ?? "",
    personalProfile.profile.remotePreference === "REMOTE"
      ? "Remote"
      : personalProfile.profile.remotePreference === "HYBRID"
        ? "Hybride"
        : "",
  ]);
}

function collectKeywords(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  return uniqueList([...searchTargets.keywords, ...personalProfile.profile.skills]);
}

function buildQueryText(parts: Array<string | null | undefined>) {
  return uniqueList(parts).join(" ");
}

function selectFocusKeywords(
  targetRole: string,
  domain: string | null,
  keywords: string[],
  offset: number,
) {
  const contextTokens = new Set([
    ...tokenizeForMatch(targetRole),
    ...tokenizeForMatch(domain),
  ]);

  const scoredKeywords = keywords.map((keyword, index) => {
    const keywordTokens = tokenizeForMatch(keyword);
    const overlapCount = keywordTokens.filter((token) => contextTokens.has(token)).length;
    const score =
      overlapCount * 10 +
      (contextTokens.has("c++") && keyword.toLowerCase().includes("c++") ? 10 : 0) +
      (contextTokens.has("c") && keyword.toLowerCase().includes("c++") ? 6 : 0);

    return {
      keyword,
      index,
      score,
    };
  });

  const strongMatches = scoredKeywords
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.keyword);

  const exploratoryKeywords = rotateList(
    scoredKeywords
      .filter((entry) => entry.score === 0)
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.keyword),
    offset,
  );

  return uniqueList([...strongMatches, ...exploratoryKeywords]).slice(0, 4);
}

function buildQueryLabel(targetRole: string, domain: string | null) {
  return domain ? `${targetRole} - ${domain}` : targetRole;
}

function buildQueryExplanation(
  targetRole: string,
  domain: string | null,
  location: string | null,
  focusKeywords: string[],
) {
  const details = [
    `role "${targetRole}"`,
    domain ? `domaine "${domain}"` : null,
    location ? `zone "${location}"` : null,
    focusKeywords.length > 0 ? `mots-cles ${focusKeywords.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `Variante construite autour du ${details}.`;
}

function createQueriesFromDiverseInputs(
  targetRoles: string[],
  domains: string[],
  locations: string[],
  keywords: string[],
  maxQueries: number,
) {
  const queries: SearchQueryCandidate[] = [];
  const seenCombinations = new Set<string>();
  const maxRounds = Math.max(domains.length, 1) * Math.max(locations.length, 1) + 2;

  for (let round = 0; round < maxRounds && queries.length < maxQueries; round += 1) {
    for (let roleIndex = 0; roleIndex < targetRoles.length; roleIndex += 1) {
      if (queries.length >= maxQueries) {
        break;
      }

      const targetRole = targetRoles[roleIndex];
      const domain = domains.length > 0 ? domains[(roleIndex + round) % domains.length] : null;
      const location =
        locations.length > 0 ? locations[(round + roleIndex) % locations.length] : null;
      const combinationKey = [
        targetRole,
        domain ?? "generic-domain",
        location ?? "generic-location",
      ].join("::");

      if (seenCombinations.has(combinationKey)) {
        continue;
      }

      const focusKeywords = selectFocusKeywords(
        targetRole,
        domain,
        keywords,
        round + roleIndex,
      );
      const queryText = buildQueryText([
        targetRole,
        domain,
        ...focusKeywords.slice(0, 3),
        location,
      ]);
      const id = slugify(`${combinationKey}-${round}`);

      seenCombinations.add(combinationKey);
      queries.push({
        id,
        label: buildQueryLabel(targetRole, domain),
        queryText,
        targetRole,
        domain,
        location,
        keywords,
        focusKeywords,
        priority: Math.max(100 - round * 12 - roleIndex * 3, 24),
        explanation: buildQueryExplanation(targetRole, domain, location, focusKeywords),
      });
    }
  }

  return queries;
}

export function buildSearchQueryPlan(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
): SearchQueryPlan {
  const targetRoles = fallbackTargetRoles(personalProfile, searchTargets).slice(0, 8);
  const domains = fallbackDomains(personalProfile, searchTargets).slice(0, 8);
  const locations = fallbackLocations(personalProfile, searchTargets).slice(0, 3);
  const keywords = collectKeywords(personalProfile, searchTargets).slice(0, 16);
  const maxQueries = Math.min(Math.max(targetRoles.length * 2, 8), 18);
  const queries = createQueriesFromDiverseInputs(
    targetRoles,
    domains,
    locations,
    keywords,
    maxQueries,
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: `Plan diversifie sur ${targetRoles.length} role(s), ${domains.length} domaine(s), ${locations.length} zone(s) et ${keywords.length} mot(s)-cles. Les premieres variantes couvrent d abord tous les roles avant de reutiliser un autre domaine ou une autre zone.`,
    inputs: {
      targetRoles,
      domains,
      locations,
      keywords,
    },
    strategy: [
      "Le moteur repart d abord sur tous les roles cibles au lieu de repeter uniquement le premier.",
      "Chaque variante tourne sur un domaine different avant de revenir sur le role suivant.",
      "Les mots-cles affiches sont les mots-cles reellement injectes dans la requete, pas une liste abstraite.",
      "Les localisations restent visibles comme contexte de recherche, sans masquer le role ou le domaine principal.",
    ],
    queries,
  };
}
