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

export type SearchDiscoveryOffer = {
  id: string;
  provider: "wttj";
  sourceKind: "JOB_BOARD";
  sourceSite: "Welcome to the Jungle";
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
  relevanceScore: number;
  relevanceLabel: "Tres forte" | "Forte" | "Intermediaire" | "Exploratoire";
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
  provider: "wttj";
  providerLabel: "Welcome to the Jungle";
  language: "fr" | "en";
  filters: string[];
  totalHits: number;
  returnedHits: number;
};

export type SearchDiscoveryResult = {
  generatedAt: string;
  summary: string;
  planSummary: string;
  queryCount: number;
  executedQueryCount: number;
  offerCount: number;
  providers: Array<{
    id: "wttj";
    label: "Welcome to the Jungle";
    language: "fr" | "en";
  }>;
  queryExecutions: SearchDiscoveryQueryExecution[];
  warnings: string[];
  offers: SearchDiscoveryOffer[];
  normalizedOffers: NormalizedOpportunity[];
};
