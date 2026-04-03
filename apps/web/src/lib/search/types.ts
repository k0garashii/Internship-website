export type NormalizedOpportunity = {
  id: string;
  rawSourceId: string;
  fingerprint: string;
  origin: "WEB_DISCOVERY" | "INBOUND_EMAIL";
  sourceKind: "JOB_BOARD" | "COMPANY_CAREERS" | "INBOUND_EMAIL";
  sourceProvider: string;
  sourceLabel: string;
  title: string | null;
  companyName: string | null;
  locationLabel: string | null;
  countryCode: string | null;
  contractType: string | null;
  workMode: string | null;
  description: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  capturedAt: string;
  signal: string | null;
};

export type OfferProfileMatchBreakdownItem = {
  criterion: string;
  awarded: number;
  max: number;
  reason: string;
  matchedTerms: string[];
};

export type OfferProfileMatch = {
  score: number;
  label: "Tres forte" | "Forte" | "Intermediaire" | "Exploratoire";
  summary: string;
  breakdown: OfferProfileMatchBreakdownItem[];
};

export type SearchDiscoveryOffer = {
  id: string;
  provider: string;
  sourceKind: "JOB_BOARD" | "COMPANY_CAREERS";
  sourceSite: string;
  title: string;
  companyName: string;
  companySlug: string | null;
  locationLabel: string | null;
  countryCode: string | null;
  contractType: string | null;
  remoteMode: string | null;
  publishedAt: string | null;
  sourceUrl: string;
  summary: string | null;
  profileSnippet: string | null;
  matchedQueryIds: string[];
  matchedQueryLabels: string[];
  matchedKeywords: string[];
  priorityScore: number;
  relevanceScore: number;
  relevanceLabel: "Tres forte" | "Forte" | "Intermediaire" | "Exploratoire";
  matching: OfferProfileMatch;
};

export type SearchDiscoveryQueryExecution = {
  id: string;
  label: string;
  targetRole: string;
  domain: string | null;
  location: string | null;
  focusKeywords: string[];
  queryText: string;
  requestedQueryText: string;
  provider: string;
  providerLabel: string;
  language: "fr" | "en" | "multi";
  filters: string[];
  totalHits: number;
  returnedHits: number;
};

export type SearchDiscoveryPersistenceSummary = {
  searchRunId: string;
  persistedOfferCount: number;
  createdOfferCount: number;
  updatedOfferCount: number;
};

export type PersistedOfferLifecycleStatus =
  | "DISCOVERED"
  | "NORMALIZED"
  | "SCORED"
  | "SHORTLISTED"
  | "APPLIED"
  | "ARCHIVED";

export type PersistedOfferFeedbackDecision =
  | "NOT_RELEVANT"
  | "MAYBE"
  | "FAVORITE"
  | "APPLIED"
  | "INTERVIEWING"
  | "REJECTED"
  | "OFFER_ACCEPTED";

export type PersistedOfferListItem = {
  id: string;
  title: string;
  companyName: string;
  sourceSite: string;
  sourceUrl: string;
  locationLabel: string | null;
  lifecycleStatus: PersistedOfferLifecycleStatus;
  postedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  latestMatchScore: number | null;
  latestRank: number | null;
  latestSearchRunId: string | null;
  latestSearchLabel: string | null;
  latestSearchStatus: "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELED" | null;
  matchExplanation: string | null;
  isShortlisted: boolean;
  latestFeedbackDecision: PersistedOfferFeedbackDecision | null;
  latestFeedbackNote: string | null;
};

export type PersistedOfferListResult = {
  generatedAt: string;
  summary: string;
  offerCount: number;
  statusCounts: Partial<Record<PersistedOfferLifecycleStatus, number>>;
  offers: PersistedOfferListItem[];
};

export type PersistedOfferDetailSearchMatch = {
  id: string;
  discoveredAt: string;
  rank: number | null;
  rawScore: number | null;
  normalizedScore: number | null;
  matchExplanation: string | null;
  isShortlisted: boolean;
  searchRunId: string;
  searchRunLabel: string;
  searchRunStatus: "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELED";
};

export type PersistedOfferDetailFeedbackEntry = {
  id: string;
  decision: PersistedOfferFeedbackDecision;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersistedOfferDetailDraftEntry = {
  id: string;
  status: "DRAFT" | "READY_FOR_REVIEW" | "APPROVED" | "SENT" | "ARCHIVED";
  subject: string | null;
  generatedBy: string | null;
  personalizationSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersistedOfferDetailResult = {
  generatedAt: string;
  offer: {
    id: string;
    title: string;
    companyName: string;
    sourceSite: string;
    sourceUrl: string;
    sourceKind: "COMPANY_CAREERS" | "JOB_BOARD" | "AGENCY" | "REFERRAL" | "OTHER";
    lifecycleStatus: PersistedOfferLifecycleStatus;
    locationLabel: string | null;
    countryCode: string | null;
    employmentType:
      | "INTERNSHIP"
      | "APPRENTICESHIP"
      | "FULL_TIME"
      | "PART_TIME"
      | "TEMPORARY"
      | "FREELANCE"
      | null;
    workMode: "REMOTE" | "HYBRID" | "ONSITE" | "FLEXIBLE" | null;
    postedAt: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    description: string | null;
    latestMatchScore: number | null;
    latestMatchLabel: OfferProfileMatch["label"] | null;
    latestMatchExplanation: string | null;
    latestFeedbackDecision: PersistedOfferFeedbackDecision | null;
    latestFeedbackNote: string | null;
    matchedQueryLabels: string[];
    matchedKeywords: string[];
    matchingBreakdown: OfferProfileMatchBreakdownItem[];
    normalizedOpportunity: NormalizedOpportunity | null;
    deduplication: {
      sourceFingerprints: string[];
      sourceOfferIds: string[];
      sourceUrls: string[];
      providers: string[];
    };
  };
  searchMatches: PersistedOfferDetailSearchMatch[];
  feedbackEntries: PersistedOfferDetailFeedbackEntry[];
  drafts: PersistedOfferDetailDraftEntry[];
};

export type SearchHistoryEntry = {
  id: string;
  label: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELED";
  queryText: string | null;
  resultCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  topOffers: Array<{
    jobOfferId: string;
    title: string;
    companyName: string;
    sourceUrl: string;
    rank: number | null;
    matchScore: number | null;
  }>;
};

export type SearchHistoryResult = {
  generatedAt: string;
  summary: string;
  runCount: number;
  runs: SearchHistoryEntry[];
};

export type SearchDiscoveryResult = {
  generatedAt: string;
  summary: string;
  planSummary: string;
  queryCount: number;
  executedQueryCount: number;
  offerCount: number;
  providers: Array<{
    id: string;
    label: string;
    language: "fr" | "en" | "multi";
    offerCount: number;
  }>;
  queryExecutions: SearchDiscoveryQueryExecution[];
  warnings: string[];
  offers: SearchDiscoveryOffer[];
  normalizedOffers: NormalizedOpportunity[];
  persistence: SearchDiscoveryPersistenceSummary | null;
};
