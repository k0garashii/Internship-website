import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { InferredSearchPreference } from "@/lib/profile/personalization-model";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
import type {
  OfferProfileMatch,
  OfferProfileMatchBreakdownItem,
  SearchDiscoveryOffer,
} from "@/lib/search/types";

type MatchConfig = {
  personalProfile: PersonalProfileFile;
  searchTargets: SearchTargetsFile;
  inferredPreferences?: InferredSearchPreference[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function overlap(left: string[], rightSet: Set<string>) {
  return unique(left.filter((item) => rightSet.has(item)));
}

function addBreakdown(
  breakdown: OfferProfileMatchBreakdownItem[],
  item: OfferProfileMatchBreakdownItem | null,
) {
  if (item && item.awarded > 0) {
    breakdown.push(item);
  }
}

function labelFromScore(score: number): OfferProfileMatch["label"] {
  if (score >= 82) {
    return "Tres forte";
  }

  if (score >= 68) {
    return "Forte";
  }

  if (score >= 52) {
    return "Intermediaire";
  }

  return "Exploratoire";
}

function buildSummary(score: number, breakdown: OfferProfileMatchBreakdownItem[]) {
  const strongest = breakdown
    .slice()
    .sort((left, right) => right.awarded - left.awarded)
    .slice(0, 2)
    .map((item) => item.criterion.toLowerCase());

  if (strongest.length === 0) {
    return `Match ${score}/100 base surtout sur les signaux faibles de l offre.`;
  }

  return `Match ${score}/100 tire principalement par ${strongest.join(" et ")}.`;
}

function scoreRoleAlignment(offer: SearchDiscoveryOffer, config: MatchConfig) {
  const offerTokenSet = new Set(
    unique([
      ...tokenize(offer.title),
      ...tokenize(offer.summary),
      ...tokenize(offer.profileSnippet),
    ]),
  );
  const roles = config.searchTargets.targets.map((target) => target.title);

  let best: OfferProfileMatchBreakdownItem | null = null;

  for (const role of roles) {
    const roleTokens = tokenize(role);
    const matchedTerms = overlap(roleTokens, offerTokenSet);

    if (matchedTerms.length === 0) {
      continue;
    }

    const awarded = clamp(Math.round((matchedTerms.length / roleTokens.length) * 26), 8, 26);
    const candidate = {
      criterion: "Role cible",
      awarded,
      max: 26,
      reason: `Le titre de l offre recoupe le role cible "${role}".`,
      matchedTerms,
    } satisfies OfferProfileMatchBreakdownItem;

    if (!best || candidate.awarded > best.awarded) {
      best = candidate;
    }
  }

  return best;
}

function scoreQueryCoverage(offer: SearchDiscoveryOffer) {
  if (offer.matchedQueryIds.length === 0) {
    return null;
  }

  return {
    criterion: "Convergence requetes",
    awarded: clamp(offer.matchedQueryIds.length * 5, 5, 12),
    max: 12,
    reason: "Plusieurs variantes du plan utilisateur convergent vers la meme offre.",
    matchedTerms: offer.matchedQueryLabels.slice(0, 4),
  } satisfies OfferProfileMatchBreakdownItem;
}

function scorePriorityAlignment(offer: SearchDiscoveryOffer) {
  if (offer.priorityScore >= 95) {
    return {
      criterion: "Priorite utilisateur",
      awarded: 12,
      max: 12,
      reason: "L offre remonte via une requete au sommet des priorites utilisateur.",
      matchedTerms: [`priorite ${offer.priorityScore}`],
    } satisfies OfferProfileMatchBreakdownItem;
  }

  if (offer.priorityScore >= 85) {
    return {
      criterion: "Priorite utilisateur",
      awarded: 10,
      max: 12,
      reason: "L offre remonte via une requete fortement priorisee.",
      matchedTerms: [`priorite ${offer.priorityScore}`],
    } satisfies OfferProfileMatchBreakdownItem;
  }

  if (offer.priorityScore >= 70) {
    return {
      criterion: "Priorite utilisateur",
      awarded: 7,
      max: 12,
      reason: "L offre remonte via une requete plutot prioritaire pour l utilisateur.",
      matchedTerms: [`priorite ${offer.priorityScore}`],
    } satisfies OfferProfileMatchBreakdownItem;
  }

  if (offer.priorityScore >= 55) {
    return {
      criterion: "Priorite utilisateur",
      awarded: 4,
      max: 12,
      reason: "L offre remonte via une requete secondaire mais toujours valide.",
      matchedTerms: [`priorite ${offer.priorityScore}`],
    } satisfies OfferProfileMatchBreakdownItem;
  }

  return null;
}

function scoreSkillsAlignment(offer: SearchDiscoveryOffer, config: MatchConfig) {
  const offerTokenSet = new Set(
    unique([
      ...tokenize(offer.title),
      ...tokenize(offer.summary),
      ...tokenize(offer.profileSnippet),
    ]),
  );
  const profileSkills = config.personalProfile.profile.skills;
  const searchKeywords = config.searchTargets.keywords;
  const skillTerms = unique([
    ...profileSkills.flatMap((item) => tokenize(item)),
    ...searchKeywords.flatMap((item) => tokenize(item)),
  ]);
  const matchedTerms = overlap(skillTerms, offerTokenSet);

  if (matchedTerms.length === 0) {
    return null;
  }

  return {
    criterion: "Competences",
    awarded: clamp(matchedTerms.length * 5, 5, 26),
    max: 26,
    reason: "Le contenu de l offre recoupe les competences ou mots cles sauvegardes.",
    matchedTerms: matchedTerms.slice(0, 8),
  } satisfies OfferProfileMatchBreakdownItem;
}

function scoreDomainAlignment(offer: SearchDiscoveryOffer, config: MatchConfig) {
  const offerTokenSet = new Set(
    unique([
      ...tokenize(offer.title),
      ...tokenize(offer.summary),
      ...tokenize(offer.profileSnippet),
      ...offer.matchedQueryLabels.flatMap((item) => tokenize(item)),
      ...offer.matchedKeywords.flatMap((item) => tokenize(item)),
    ]),
  );
  const domainTerms = unique(
    config.searchTargets.preferredDomains.flatMap((domain) => tokenize(domain.label)),
  );
  const matchedTerms = overlap(domainTerms, offerTokenSet);

  if (matchedTerms.length === 0) {
    return null;
  }

  return {
    criterion: "Domaines",
    awarded: clamp(matchedTerms.length * 4, 4, 18),
    max: 18,
    reason: "Les domaines valides de l utilisateur se retrouvent dans l opportunite.",
    matchedTerms: matchedTerms.slice(0, 6),
  } satisfies OfferProfileMatchBreakdownItem;
}

function scoreLocationAlignment(offer: SearchDiscoveryOffer, config: MatchConfig) {
  const normalizedLocation = normalizeText(offer.locationLabel);
  const remoteMode = normalizeText(offer.remoteMode);
  const preferredLocations = config.searchTargets.preferredLocations;
  const matchedLabels = preferredLocations
    .map((location) => location.label)
    .filter((label) => {
      const normalizedLabel = normalizeText(label);

      if (!normalizedLabel) {
        return false;
      }

      if (normalizedLocation && normalizedLocation.includes(normalizedLabel)) {
        return true;
      }

      if (normalizedLabel === "remote" && remoteMode && remoteMode !== "no") {
        return true;
      }

      return false;
    });

  if (matchedLabels.length === 0) {
    return null;
  }

  return {
    criterion: "Localisation",
    awarded: clamp(matchedLabels.length * 7, 7, 14),
    max: 14,
    reason: "La localisation ou le mode de travail colle aux zones preferees.",
    matchedTerms: matchedLabels,
  } satisfies OfferProfileMatchBreakdownItem;
}

function scoreContractAlignment(offer: SearchDiscoveryOffer, config: MatchConfig) {
  const contractTypes = unique(
    config.searchTargets.targets.flatMap((target) =>
      target.employmentTypes.map((item) => item.toLowerCase()),
    ),
  );
  const normalizedContract = normalizeText(offer.contractType);

  if (!normalizedContract || contractTypes.length === 0) {
    return null;
  }

  const matched = contractTypes.find((item) => item.includes(normalizedContract));

  if (!matched) {
    return null;
  }

  return {
    criterion: "Type de contrat",
    awarded: 10,
    max: 10,
    reason: "Le contrat de l offre correspond au type vise dans les preferences.",
    matchedTerms: [normalizedContract],
  } satisfies OfferProfileMatchBreakdownItem;
}

function scoreWorkModeAlignment(config: MatchConfig, offer: SearchDiscoveryOffer) {
  const remotePreference = config.personalProfile.profile.remotePreference;

  if (!remotePreference || !offer.remoteMode) {
    return null;
  }

  const remoteMode = normalizeText(offer.remoteMode);
  const matches =
    (remotePreference === "REMOTE" && remoteMode === "fulltime") ||
    (remotePreference === "HYBRID" && remoteMode === "partial") ||
    (remotePreference === "ONSITE" && remoteMode === "no") ||
    (remotePreference === "FLEXIBLE" && ["fulltime", "partial", "punctual"].includes(remoteMode));

  if (!matches) {
    return null;
  }

  return {
    criterion: "Mode de travail",
    awarded: 6,
    max: 6,
    reason: "Le mode de travail de l offre colle a la preference enregistree.",
    matchedTerms: [remotePreference, offer.remoteMode],
  } satisfies OfferProfileMatchBreakdownItem;
}

function scoreExperienceAlignment(config: MatchConfig, offer: SearchDiscoveryOffer) {
  const experienceLevel = config.personalProfile.profile.experienceLevel;

  if (!experienceLevel) {
    return null;
  }

  const haystack = normalizeText([offer.title, offer.summary, offer.profileSnippet].join(" "));
  const levelMatchers: Record<string, string[]> = {
    INTERN: ["intern", "internship", "stage", "apprenticeship", "alternance"],
    ENTRY_LEVEL: ["junior", "entry", "graduate"],
    JUNIOR: ["junior", "graduate"],
    MID: ["mid", "confirm"],
    SENIOR: ["senior", "lead"],
    LEAD: ["lead", "principal", "staff"],
  };

  const matchedTerms = (levelMatchers[experienceLevel] ?? []).filter((term) =>
    haystack.includes(term),
  );

  if (matchedTerms.length === 0) {
    return null;
  }

  return {
    criterion: "Seniorite",
    awarded: 6,
    max: 6,
    reason: "La seniorite suggeree par l offre reste compatible avec le niveau vise.",
    matchedTerms,
  } satisfies OfferProfileMatchBreakdownItem;
}

function scoreInferredPreferenceBoost(config: MatchConfig, offer: SearchDiscoveryOffer) {
  const inferredPreferences = (config.inferredPreferences ?? []).filter(
    (preference) => preference.polarity === "POSITIVE",
  );

  if (inferredPreferences.length === 0) {
    return null;
  }

  const offerTokenSet = new Set(
    unique([
      ...tokenize(offer.title),
      ...tokenize(offer.summary),
      ...tokenize(offer.profileSnippet),
      ...tokenize(offer.companyName),
      ...tokenize(offer.locationLabel),
    ]),
  );
  const matchedTerms: string[] = [];
  let awarded = 0;

  for (const preference of inferredPreferences) {
    const preferenceTokens = tokenize(preference.value);
    const overlaps = overlap(preferenceTokens, offerTokenSet);

    if (overlaps.length === 0) {
      continue;
    }

    matchedTerms.push(preference.value);

    const confidenceMultiplier =
      preference.confidence === "HIGH" ? 1.25 : preference.confidence === "MEDIUM" ? 1 : 0.75;
    const baseAward =
      preference.axis === "ROLE" || preference.axis === "COMPANY"
        ? 5
        : preference.axis === "DOMAIN" || preference.axis === "TECHNOLOGY"
          ? 4
          : 3;

    awarded += Math.round(baseAward * confidenceMultiplier);
  }

  if (awarded <= 0) {
    return null;
  }

  return {
    criterion: "Signaux implicites",
    awarded: clamp(awarded, 3, 18),
    max: 18,
    reason:
      "Des interactions passees de l utilisateur renforcent la pertinence de cette offre sans remplacer les preferences declarees.",
    matchedTerms: unique(matchedTerms).slice(0, 6),
  } satisfies OfferProfileMatchBreakdownItem;
}

export function matchProfileToOffer(
  config: MatchConfig,
  offer: SearchDiscoveryOffer,
): OfferProfileMatch {
  const breakdown: OfferProfileMatchBreakdownItem[] = [];

  addBreakdown(breakdown, scoreRoleAlignment(offer, config));
  addBreakdown(breakdown, scoreQueryCoverage(offer));
  addBreakdown(breakdown, scorePriorityAlignment(offer));
  addBreakdown(breakdown, scoreSkillsAlignment(offer, config));
  addBreakdown(breakdown, scoreDomainAlignment(offer, config));
  addBreakdown(breakdown, scoreLocationAlignment(offer, config));
  addBreakdown(breakdown, scoreContractAlignment(offer, config));
  addBreakdown(breakdown, scoreWorkModeAlignment(config, offer));
  addBreakdown(breakdown, scoreExperienceAlignment(config, offer));
  addBreakdown(breakdown, scoreInferredPreferenceBoost(config, offer));

  const score = clamp(
    breakdown.reduce((total, item) => total + item.awarded, 0),
    20,
    96,
  );

  return {
    score,
    label: labelFromScore(score),
    summary: buildSummary(score, breakdown),
    breakdown,
  };
}
