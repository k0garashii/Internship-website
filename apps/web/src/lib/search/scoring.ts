import type { SearchDiscoveryOffer } from "@/lib/search/types";

type OfferScoringInput = Pick<
  SearchDiscoveryOffer,
  "contractType" | "matchedKeywords" | "matchedQueryIds" | "profileSnippet" | "publishedAt" | "summary"
>;

export type OfferScoringBreakdownItem = {
  criterion: string;
  awarded: number;
  cap?: number;
  reason: string;
};

export type OfferScoringResult = {
  score: number;
  label: SearchDiscoveryOffer["relevanceLabel"];
  breakdown: OfferScoringBreakdownItem[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function buildOfferScoreLabel(score: number): SearchDiscoveryOffer["relevanceLabel"] {
  if (score >= 85) {
    return "Tres forte";
  }

  if (score >= 72) {
    return "Forte";
  }

  if (score >= 58) {
    return "Intermediaire";
  }

  return "Exploratoire";
}

export function scoreDiscoveryOffer(offer: OfferScoringInput): OfferScoringResult {
  const breakdown: OfferScoringBreakdownItem[] = [
    {
      criterion: "Base",
      awarded: 36,
      reason: "Point de depart commun a toute opportunite valide.",
    },
  ];

  breakdown.push({
    criterion: "Correspondance requetes",
    awarded: Math.min(offer.matchedQueryIds.length * 18, 36),
    cap: 36,
    reason: "Plusieurs variantes du plan convergent vers la meme offre.",
  });

  breakdown.push({
    criterion: "Mots cles retrouves",
    awarded: Math.min(offer.matchedKeywords.length * 7, 28),
    cap: 28,
    reason: "Le contenu de l offre recoupe les mots cles du profil et des preferences.",
  });

  if (offer.contractType === "internship" || offer.contractType === "apprenticeship") {
    breakdown.push({
      criterion: "Contrat cible",
      awarded: 10,
      reason: "Le type de contrat correspond a un usage stage / alternance.",
    });
  }

  if (offer.profileSnippet) {
    breakdown.push({
      criterion: "Profil de poste detaille",
      awarded: 6,
      reason: "La source fournit un extrait profil exploitable.",
    });
  }

  if (offer.summary) {
    breakdown.push({
      criterion: "Resume source",
      awarded: 4,
      reason: "La source fournit un resume textuel exploitable.",
    });
  }

  if (offer.publishedAt) {
    const ageInDays = (Date.now() - Date.parse(offer.publishedAt)) / (1000 * 60 * 60 * 24);

    if (ageInDays <= 7) {
      breakdown.push({
        criterion: "Fraicheur",
        awarded: 10,
        reason: "Publication de moins de 7 jours.",
      });
    } else if (ageInDays <= 21) {
      breakdown.push({
        criterion: "Fraicheur",
        awarded: 6,
        reason: "Publication de moins de 21 jours.",
      });
    } else if (ageInDays <= 45) {
      breakdown.push({
        criterion: "Fraicheur",
        awarded: 3,
        reason: "Publication encore recente a l echelle d une recherche de stage.",
      });
    }
  }

  const score = clamp(
    Math.round(breakdown.reduce((total, item) => total + item.awarded, 0)),
    35,
    98,
  );

  return {
    score,
    label: buildOfferScoreLabel(score),
    breakdown,
  };
}
