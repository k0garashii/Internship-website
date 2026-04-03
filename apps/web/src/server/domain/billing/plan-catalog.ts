import { BillingInterval, BillingProvider, WorkspaceFeature } from "@prisma/client";

export type PlanFeatureConfig = {
  enabled: boolean;
  limitValue?: number | null;
};

export type PlanFeatureMatrix = Record<WorkspaceFeature, PlanFeatureConfig>;

export type PlanCatalogEntry = {
  code: string;
  name: string;
  provider: BillingProvider;
  billingInterval: BillingInterval;
  priceCents: number;
  currency: string;
  isDefault: boolean;
  featureMatrix: PlanFeatureMatrix;
};

const freeMatrix: PlanFeatureMatrix = {
  [WorkspaceFeature.SEARCH_DISCOVERY]: {
    enabled: true,
    limitValue: 50,
  },
  [WorkspaceFeature.EMAIL_DRAFT_GENERATION]: {
    enabled: true,
    limitValue: 50,
  },
  [WorkspaceFeature.EMAIL_GMAIL_SYNC]: {
    enabled: true,
    limitValue: 100,
  },
  [WorkspaceFeature.EMAIL_GMAIL_SEND]: {
    enabled: true,
    limitValue: 50,
  },
  [WorkspaceFeature.COMPANY_TARGETING]: {
    enabled: true,
    limitValue: 50,
  },
  [WorkspaceFeature.PROFILE_ENRICHMENT]: {
    enabled: true,
    limitValue: 25,
  },
  [WorkspaceFeature.API_ACCESS]: {
    enabled: false,
    limitValue: 0,
  },
};

const proMatrix: PlanFeatureMatrix = {
  [WorkspaceFeature.SEARCH_DISCOVERY]: {
    enabled: true,
    limitValue: 500,
  },
  [WorkspaceFeature.EMAIL_DRAFT_GENERATION]: {
    enabled: true,
    limitValue: 500,
  },
  [WorkspaceFeature.EMAIL_GMAIL_SYNC]: {
    enabled: true,
    limitValue: 1000,
  },
  [WorkspaceFeature.EMAIL_GMAIL_SEND]: {
    enabled: true,
    limitValue: 500,
  },
  [WorkspaceFeature.COMPANY_TARGETING]: {
    enabled: true,
    limitValue: 500,
  },
  [WorkspaceFeature.PROFILE_ENRICHMENT]: {
    enabled: true,
    limitValue: 250,
  },
  [WorkspaceFeature.API_ACCESS]: {
    enabled: true,
    limitValue: 10000,
  },
};

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    code: "FREE",
    name: "Free",
    provider: BillingProvider.INTERNAL,
    billingInterval: BillingInterval.MONTHLY,
    priceCents: 0,
    currency: "EUR",
    isDefault: true,
    featureMatrix: freeMatrix,
  },
  {
    code: "PRO",
    name: "Pro",
    provider: BillingProvider.INTERNAL,
    billingInterval: BillingInterval.MONTHLY,
    priceCents: 1900,
    currency: "EUR",
    isDefault: false,
    featureMatrix: proMatrix,
  },
];

export function getDefaultPlanDefinition() {
  return PLAN_CATALOG.find((plan) => plan.isDefault) ?? PLAN_CATALOG[0];
}

export function normalizePlanFeatureMatrix(value: unknown): PlanFeatureMatrix {
  const fallback = getDefaultPlanDefinition().featureMatrix;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const input = value as Record<string, unknown>;
  const output = {} as PlanFeatureMatrix;

  for (const feature of Object.values(WorkspaceFeature)) {
    const candidate = input[feature];
    const fallbackValue = fallback[feature];

    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      output[feature] = fallbackValue;
      continue;
    }

    output[feature] = {
      enabled:
        typeof (candidate as { enabled?: unknown }).enabled === "boolean"
          ? ((candidate as { enabled: boolean }).enabled ?? false)
          : fallbackValue.enabled,
      limitValue:
        typeof (candidate as { limitValue?: unknown }).limitValue === "number"
          ? ((candidate as { limitValue: number }).limitValue ?? null)
          : fallbackValue.limitValue ?? null,
    };
  }

  return output;
}
