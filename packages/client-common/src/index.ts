export type WorkspaceFeatureKey =
  | "SEARCH_DISCOVERY"
  | "EMAIL_DRAFT_GENERATION"
  | "EMAIL_GMAIL_SYNC"
  | "EMAIL_GMAIL_SEND"
  | "COMPANY_TARGETING"
  | "PROFILE_ENRICHMENT"
  | "API_ACCESS";

export type WorkspaceEntitlementDto = {
  feature: WorkspaceFeatureKey;
  enabled: boolean;
  limitValue: number | null;
  source: "PLAN" | "OVERRIDE";
};

export type WorkspaceCommercialSnapshotDto = {
  workspaceId: string;
  planCode: string | null;
  planName: string | null;
  status: string | null;
};

export type SearchPersistenceSummaryDto = {
  searchRunId: string;
  persistedOfferCount: number;
  createdOfferCount: number;
  updatedOfferCount: number;
};

export type {
  DeclaredSearchProfileSnapshotDto,
  InferredSearchPreferenceDto,
  SearchBehaviorEventDefinitionDto,
  SearchBehaviorEventType,
  SearchPersonalizationGuardrailDto,
  SearchPersonalizationSnapshotDto,
  SearchPreferenceAxis,
  SearchPreferenceConfidence,
  SearchPreferencePolarity,
  SearchProfileSignalSource,
  SearchSignalStrength,
} from "./profile-personalization";
