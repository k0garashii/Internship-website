import assert from "node:assert/strict";
import test from "node:test";

import { WorkspaceFeature } from "@prisma/client";

import { AUTH_PROVIDER_CATALOG, AUTH_PROVIDER_IDS } from "../../src/server/domain/auth/providers";
import {
  getDefaultPlanDefinition,
  normalizePlanFeatureMatrix,
} from "../../src/server/domain/billing/plan-catalog";

test("plan catalog exposes a default free plan with feature flags", () => {
  const defaultPlan = getDefaultPlanDefinition();

  assert.equal(defaultPlan.code, "FREE");
  assert.equal(defaultPlan.featureMatrix[WorkspaceFeature.SEARCH_DISCOVERY].enabled, true);
  assert.equal(defaultPlan.featureMatrix[WorkspaceFeature.API_ACCESS].enabled, false);
});

test("normalizePlanFeatureMatrix falls back to the default matrix", () => {
  const normalized = normalizePlanFeatureMatrix(null);

  assert.equal(
    normalized[WorkspaceFeature.EMAIL_GMAIL_SYNC].enabled,
    getDefaultPlanDefinition().featureMatrix[WorkspaceFeature.EMAIL_GMAIL_SYNC].enabled,
  );
});

test("auth provider catalog includes password and google providers", () => {
  assert.ok(
    AUTH_PROVIDER_CATALOG.some(
      (provider) => provider.id === AUTH_PROVIDER_IDS.EMAIL_PASSWORD,
    ),
  );
  assert.ok(
    AUTH_PROVIDER_CATALOG.some(
      (provider) => provider.id === AUTH_PROVIDER_IDS.GOOGLE_OAUTH,
    ),
  );
});
