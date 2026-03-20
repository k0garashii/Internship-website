import assert from "node:assert/strict";
import test from "node:test";

import { isAuthRoute, isProtectedRoute } from "../../src/lib/auth/route-protection";
import {
  AuthorizationError,
  assertOwnedByViewer,
  scopedWhere,
  userScope,
} from "../../src/lib/security/ownership";
import { profileOnboardingSchema } from "../../src/lib/profile/schema";

const viewer = {
  userId: "user_test",
  sessionId: "session_test",
  email: "test@example.com",
} as const;

test("route protection classifies workspace and auth paths correctly", () => {
  assert.equal(isProtectedRoute("/workspace"), true);
  assert.equal(isProtectedRoute("/workspace/search/offers/123"), true);
  assert.equal(isProtectedRoute("/sign-in"), false);

  assert.equal(isAuthRoute("/sign-in"), true);
  assert.equal(isAuthRoute("/sign-up"), true);
  assert.equal(isAuthRoute("/workspace"), false);
});

test("user scope helpers prevent cross-user access", () => {
  assert.deepEqual(userScope(viewer), { userId: "user_test" });
  assert.deepEqual(scopedWhere(viewer, { id: "offer_1" }), {
    id: "offer_1",
    userId: "user_test",
  });

  assert.throws(
    () => scopedWhere(viewer, { userId: "other_user" }),
    AuthorizationError,
  );

  assert.doesNotThrow(() => assertOwnedByViewer(viewer, "user_test", "offer"));
  assert.throws(
    () => assertOwnedByViewer(viewer, "other_user", "offer"),
    AuthorizationError,
  );
});

test("onboarding schema normalizes URLs without an explicit protocol", () => {
  const parsed = profileOnboardingSchema.parse({
    fullName: "Sasha Martin",
    headline: "Backend intern",
    summary: "Profil test",
    school: "EPITA",
    degree: "Cycle ingenieur",
    graduationYear: "2027",
    city: "Paris",
    countryCode: "FR",
    remotePreference: "HYBRID",
    experienceLevel: "INTERN",
    availabilityDate: "2026-06-01",
    availabilityEndDate: "2026-12-31",
    linkedinUrl: "www.linkedin.com/in/sasha-menez",
    githubUrl: "github.com/sasha",
    portfolioUrl: "",
    resumeUrl: "",
    visaNeedsSponsorship: false,
    salaryExpectationMin: "1200",
    salaryExpectationMax: "1600",
    skills: "TypeScript, Node.js",
    targetRoles: "Backend Engineer",
    searchKeywords: "backend, node",
    preferredLocations: "Paris",
    preferredDomains: "SaaS",
    preferencesNotes: "Test",
    employmentTypes: ["INTERNSHIP"],
  });

  assert.equal(
    parsed.linkedinUrl,
    "https://www.linkedin.com/in/sasha-menez",
  );
  assert.equal(parsed.githubUrl, "https://github.com/sasha");
});
