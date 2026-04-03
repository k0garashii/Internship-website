import { WorkspaceFeature } from "@prisma/client";

export const FEATURE_LABELS: Record<WorkspaceFeature, string> = {
  [WorkspaceFeature.SEARCH_DISCOVERY]: "Collecte d'offres",
  [WorkspaceFeature.EMAIL_DRAFT_GENERATION]: "Generation de brouillons",
  [WorkspaceFeature.EMAIL_GMAIL_SYNC]: "Synchronisation Gmail",
  [WorkspaceFeature.EMAIL_GMAIL_SEND]: "Envoi Gmail",
  [WorkspaceFeature.COMPANY_TARGETING]: "Ciblage d'entreprises",
  [WorkspaceFeature.PROFILE_ENRICHMENT]: "Enrichissement du profil",
  [WorkspaceFeature.API_ACCESS]: "Acces API",
};

export function getFeatureAccessErrorMessage(feature: WorkspaceFeature) {
  return `${FEATURE_LABELS[feature]} n'est pas active pour ce workspace`;
}
