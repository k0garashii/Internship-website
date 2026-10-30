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
    label: "Plan de recherche consulté",
    description: "L’utilisateur consulte le plan de recherche avant exécution.",
  },
  {
    type: "SEARCH_EXECUTED",
    category: "DISCOVERY",
    strength: "MEDIUM",
    affectsAxes: ["ROLE", "DOMAIN", "KEYWORD", "LOCATION"],
    label: "Recherche lancée",
    description: "Lancement effectif d’une recherche à partir d’un plan ou d’un filtre.",
  },
  {
    type: "SEARCH_RESULT_OPENED",
    category: "ENGAGEMENT",
    strength: "MEDIUM",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY"],
    label: "Offre ouverte",
    description: "Ouverture d’une fiche offre ou d’un lien source.",
  },
  {
    type: "SEARCH_RESULT_EXPANDED",
    category: "ENGAGEMENT",
    strength: "MEDIUM",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY"],
    label: "Lecture approfondie d’offre",
    description:
      "Consultation détaillée d’une offre avec temps d’attention supérieur à un simple clic.",
  },
  {
    type: "COMPANY_TARGET_OPENED",
    category: "ENGAGEMENT",
    strength: "MEDIUM",
    affectsAxes: ["COMPANY", "COMPANY_TYPE", "DOMAIN"],
    label: "Entreprise cible ouverte",
    description: "Ouverture de la page détail d’une entreprise cible.",
  },
  {
    type: "ATS_SOURCE_OPENED",
    category: "ENGAGEMENT",
    strength: "MEDIUM",
    affectsAxes: ["COMPANY", "COMPANY_TYPE"],
    label: "Portail carrière ouvert",
    description: "Ouverture d’une page ATS ou carrière rattachée à une entreprise cible.",
  },
  {
    type: "OFFER_SAVED",
    category: "EXPLICIT_FEEDBACK",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY", "LOCATION"],
    label: "Offre mise de côté",
    description: "Signal positif fort: l’offre est conservée ou shortlistée.",
  },
  {
    type: "OFFER_DELETED",
    category: "EXPLICIT_FEEDBACK",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY", "LOCATION"],
    label: "Offre supprimée",
    description: "Signal négatif explicite: l’offre est retirée de la base utilisateur.",
  },
  {
    type: "OFFER_FEEDBACK_FAVORITE",
    category: "EXPLICIT_FEEDBACK",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY", "LOCATION"],
    label: "Offre jugée très pertinente",
    description: "Retour positif fort donne via les controles de feedback.",
  },
  {
    type: "OFFER_FEEDBACK_MAYBE",
    category: "EXPLICIT_FEEDBACK",
    strength: "MEDIUM",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY"],
    label: "Offre à revoir",
    description:
      "Retour positif modéré, utile pour répondre au doute sans verrouiller le profil.",
  },
  {
    type: "OFFER_FEEDBACK_NOT_RELEVANT",
    category: "EXPLICIT_FEEDBACK",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "TECHNOLOGY", "COMPANY", "LOCATION"],
    label: "Offre jugée non pertinente",
    description: "Retour négatif fort sur une offre jugée hors cible.",
  },
  {
    type: "DRAFT_GENERATED",
    category: "ENGAGEMENT",
    strength: "STRONG",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "TECHNOLOGY"],
    label: "Brouillon généré",
    description: "Génération d’un brouillon de candidature sur une offre ou une entreprise.",
  },
  {
    type: "EMAIL_SENT",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "LOCATION"],
    label: "Candidature envoyée",
    description: "Candidature envoyée, signal outcome fort.",
  },
  {
    type: "EMAIL_REPLY_RECEIVED",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "OUTCOME"],
    label: "Réponse reçue",
    description: "Réponse reçue dans Gmail ou la boîte synchronisée.",
  },
  {
    type: "INTERVIEW_RECORDED",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "OUTCOME"],
    label: "Entretien enregistré",
    description: "L’offre a mené à un échange qualifié type entretien.",
  },
  {
    type: "REJECTION_RECORDED",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "OUTCOME"],
    label: "Refus enregistré",
    description: "Une candidature se termine par un refus explicite.",
  },
  {
    type: "OFFER_ACCEPTED_RECORDED",
    category: "OUTCOME",
    strength: "OUTCOME",
    affectsAxes: ["ROLE", "DOMAIN", "COMPANY", "OUTCOME"],
    label: "Offre acceptée",
    description: "Une offre acceptée constitue le signal positif le plus fort.",
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
