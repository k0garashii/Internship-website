export type SearchPreferenceAxis =
  | "ROLE"
  | "DOMAIN"
  | "KEYWORD"
  | "TECHNOLOGY"
  | "LOCATION"
  | "WORK_MODE"
  | "EMPLOYMENT_TYPE"
  | "COMPANY"
  | "COMPANY_TYPE"
  | "OUTCOME";

export type SearchPreferencePolarity = "POSITIVE" | "NEGATIVE";

export type SearchPreferenceConfidence = "LOW" | "MEDIUM" | "HIGH";

export type SearchSignalStrength = "WEAK" | "MEDIUM" | "STRONG" | "OUTCOME";

export type SearchProfileSignalSource =
  | "ONBOARDING"
  | "PROFILE_EDIT"
  | "PROFILE_ENRICHMENT"
  | "SEARCH_EXECUTED"
  | "SEARCH_QUERY"
  | "SEARCH_PLAN_VIEWED"
  | "SEARCH_RESULT_OPENED"
  | "COMPANY_TARGET_OPENED"
  | "ATS_SOURCE_OPENED"
  | "OFFER_FEEDBACK"
  | "OFFER_DELETED"
  | "OFFER_SHORTLISTED"
  | "DRAFT_GENERATED"
  | "EMAIL_SENT"
  | "EMAIL_REPLY_RECEIVED"
  | "APPLICATION_OUTCOME";

export type DeclaredSearchProfileSnapshotDto = {
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

export type InferredSearchPreferenceDto = {
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

export type SearchPersonalizationGuardrailDto = {
  axis: SearchPreferenceAxis;
  mode:
    | "LOCK_EXPLICIT"
    | "BOOST_ONLY"
    | "ALLOW_EXPLORATION"
    | "REQUIRES_CONFIRMATION"
    | "NEGATIVE_ONLY_WITH_STRONG_SIGNAL";
  rationale: string;
};

export type SearchPersonalizationSnapshotDto = {
  declared: DeclaredSearchProfileSnapshotDto;
  inferred: InferredSearchPreferenceDto[];
  guardrails: SearchPersonalizationGuardrailDto[];
};

export type SearchBehaviorEventType =
  | "SEARCH_PLAN_VIEWED"
  | "SEARCH_EXECUTED"
  | "SEARCH_RESULT_OPENED"
  | "SEARCH_RESULT_EXPANDED"
  | "COMPANY_TARGET_OPENED"
  | "ATS_SOURCE_OPENED"
  | "OFFER_SAVED"
  | "OFFER_DELETED"
  | "OFFER_FEEDBACK_FAVORITE"
  | "OFFER_FEEDBACK_MAYBE"
  | "OFFER_FEEDBACK_NOT_RELEVANT"
  | "DRAFT_GENERATED"
  | "EMAIL_SENT"
  | "EMAIL_REPLY_RECEIVED"
  | "INTERVIEW_RECORDED"
  | "REJECTION_RECORDED"
  | "OFFER_ACCEPTED_RECORDED";

export type SearchBehaviorEventDefinitionDto = {
  type: SearchBehaviorEventType;
  category: "DISCOVERY" | "ENGAGEMENT" | "EXPLICIT_FEEDBACK" | "OUTCOME";
  strength: SearchSignalStrength;
  affectsAxes: SearchPreferenceAxis[];
  description: string;
};
