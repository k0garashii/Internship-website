import type { SearchPreferenceAxis } from "@/lib/profile/personalization-model";

export const searchBehaviorEventTypes = [
  "SEARCH_PLAN_VIEWED",
  "SEARCH_EXECUTED",
  "SEARCH_RESULT_OPENED",
  "SEARCH_RESULT_EXPANDED",
  "COMPANY_TARGET_OPENED",
  "ATS_SOURCE_OPENED",
  "OFFER_SAVED",
  "OFFER_DELETED",
  "OFFER_FEEDBACK_FAVORITE",
  "OFFER_FEEDBACK_MAYBE",
  "OFFER_FEEDBACK_NOT_RELEVANT",
  "DRAFT_GENERATED",
  "EMAIL_SENT",
  "EMAIL_REPLY_RECEIVED",
  "INTERVIEW_RECORDED",
  "REJECTION_RECORDED",
  "OFFER_ACCEPTED_RECORDED",
] as const;

export type SearchBehaviorEventType = (typeof searchBehaviorEventTypes)[number];

export type SearchBehaviorEventDefinition = {
  type: SearchBehaviorEventType;
  category: "DISCOVERY" | "ENGAGEMENT" | "EXPLICIT_FEEDBACK" | "OUTCOME";
  strength: "WEAK" | "MEDIUM" | "STRONG" | "OUTCOME";
  affectsAxes: SearchPreferenceAxis[];
  label: string;
  description: string;
};

export const searchBehaviorEventCatalog: SearchBehaviorEventDefinition[] = [
  {
    type: "SEARCH_PLAN_VIEWED",
    category: "DISCOVERY",
    strength: "WEAK",
    affectsAxes: ["ROLE", "DOMAIN", "KEYWORD", "LOCATION"],
    label: "Plan de recherche consulte",
    description: "L utilisateur consulte le plan de recherche avant execution.",
  },
  {
    type: "SEARCH_EXECUTED",
    category: "DISCOVERY",
    strength: "MEDIUM",
    affectsAxes: ["ROLE", "DOMAIN", "KEYWORD", "LOCATION"],
    label: "Recherche lancee",
    description: "Lancement effectif d une recherche a partir d un plan ou d un filtre.",
  },
  {
    type: "SEARCH_RESULT_OPENED",
    category: "ENGAGEMENT",
    strength: "MEDIUM",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY"],
    label: "Offre ouverte",
    description: "Ouverture d une fiche offre ou d un lien source.",
  },
  {
    type: "SEARCH_RESULT_EXPANDED",
    category: "ENGAGEMENT",
    strength: "MEDIUM",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY"],
    label: "Lecture approfondie d offre",
    description:
      "Consultation detaillee d une offre avec temps d attention superieur a un simple clic.",
  },
  {
    type: "COMPANY_TARGET_OPENED",
    category: "ENGAGEMENT",
    strength: "MEDIUM",
    affectsAxes: ["COMPANY", "COMPANY_TYPE", "DOMAIN"],
    label: "Entreprise cible ouverte",
    description: "Ouverture de la page detail d une entreprise cible.",
  },
  {
    type: "ATS_SOURCE_OPENED",
    category: "ENGAGEMENT",
    strength: "MEDIUM",
    affectsAxes: ["COMPANY", "COMPANY_TYPE"],
    label: "Portail carriere ouvert",
    description: "Ouverture d une page ATS ou carriere rattachee a une entreprise cible.",
  },
  {
    type: "OFFER_SAVED",
    category: "EXPLICIT_FEEDBACK",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY", "LOCATION"],
    label: "Offre mise de cote",
    description: "Signal positif fort: l offre est conservee ou shortlistée.",
  },
  {
    type: "OFFER_DELETED",
    category: "EXPLICIT_FEEDBACK",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY", "LOCATION"],
    label: "Offre supprimee",
    description: "Signal negatif explicite: l offre est retiree de la base utilisateur.",
  },
  {
    type: "OFFER_FEEDBACK_FAVORITE",
    category: "EXPLICIT_FEEDBACK",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY", "LOCATION"],
    label: "Offre jugee tres pertinente",
    description: "Retour positif fort donne via les controles de feedback.",
  },
  {
    type: "OFFER_FEEDBACK_MAYBE",
    category: "EXPLICIT_FEEDBACK",
    strength: "MEDIUM",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY"],
    label: "Offre a revoir",
    description:
      "Retour positif modere, utile pour repondre au doute sans verrouiller le profil.",
  },
  {
    type: "OFFER_FEEDBACK_NOT_RELEVANT",
    category: "EXPLICIT_FEEDBACK",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY", "LOCATION"],
    label: "Offre jugee non pertinente",
    description: "Retour negatif fort sur une offre jugee hors cible.",
  },
  {
    type: "DRAFT_GENERATED",
    category: "ENGAGEMENT",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "TECHNOLOGY"],
    label: "Brouillon genere",
    description: "Generation d un brouillon de candidature sur une offre ou une entreprise.",
  },
  {
    type: "EMAIL_SENT",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "LOCATION"],
    label: "Candidature envoyee",
    description: "Candidature envoyee, signal outcome fort.",
  },
  {
    type: "EMAIL_REPLY_RECEIVED",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "OUTCOME"],
    label: "Reponse recue",
    description: "Reponse recue dans Gmail ou la boite synchronisee.",
  },
  {
    type: "INTERVIEW_RECORDED",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "OUTCOME"],
    label: "Entretien enregistre",
    description: "L offre a mene a un echange qualifie type entretien.",
  },
  {
    type: "REJECTION_RECORDED",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "OUTCOME"],
    label: "Refus enregistre",
    description: "Une candidature se termine par un refus explicite.",
  },
  {
    type: "OFFER_ACCEPTED_RECORDED",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "OUTCOME"],
    label: "Offre acceptee",
    description: "Une offre acceptee constitue le signal positif le plus fort.",
  },
];

export const searchBehaviorEventCatalogByType = new Map(
  searchBehaviorEventCatalog.map((eventDefinition) => [eventDefinition.type, eventDefinition]),
);

export function getSearchBehaviorEventDefinition(type: SearchBehaviorEventType) {
  const definition = searchBehaviorEventCatalogByType.get(type);

  if (!definition) {
    throw new Error(`Unknown search behavior event type: ${type}`);
  }

  return definition;
}

export function getSearchBehaviorEventLabel(type: SearchBehaviorEventType) {
  return getSearchBehaviorEventDefinition(type).label;
}
