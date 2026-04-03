import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeclaredSearchProfileSnapshot,
  defaultSearchPersonalizationGuardrails,
} from "@/lib/profile/personalization-model";
import { searchBehaviorEventCatalog } from "@/lib/profile/personalization-signals";
import type { ProfileOnboardingData } from "@/lib/profile/schema";

function buildFixture(): ProfileOnboardingData {
  return {
    fullName: "Sasha Menez",
    headline: "",
    summary: "",
    school: "Centrale",
    degree: "Ingenieur",
    graduationYear: 2027,
    city: "Paris",
    countryCode: "FR",
    remotePreference: "HYBRID",
    experienceLevel: "INTERN",
    availabilityDate: "2026-09-01",
    availabilityEndDate: "2027-02-28",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    resumeUrl: "",
    visaNeedsSponsorship: false,
    salaryExpectationMin: null,
    salaryExpectationMax: null,
    skills: "C++, Python, OpenGL, Simulation numerique",
    preferencesNotes: "",
    targetRoles: "Software Engineer (C++), Simulation Engineer",
    searchKeywords: "C++, simulation numerique, moteur 3D",
    preferredLocations: "Paris, France entiere",
    preferredDomains: "Calcul haute performance, Recherche scientifique",
    employmentTypes: ["INTERNSHIP"],
    domainSelections: [
      {
        label: "Aero spatiale et Defense",
        rationale: "",
        source: "MANUAL",
        isValidated: true,
      },
      {
        label: "Jeux video",
        rationale: "",
        source: "MANUAL",
        isValidated: false,
      },
    ],
  };
}

test("buildDeclaredSearchProfileSnapshot keeps explicit constraints and evidence separated", () => {
  const snapshot = buildDeclaredSearchProfileSnapshot(buildFixture(), {
    enrichmentData: {
      signals: [
        { label: "C++", category: "technology" },
        { label: "Simulation numerique", category: "domain" },
        { label: "Physics Programmer", category: "role" },
        { label: "Temps reel", category: "keyword" },
      ],
    },
  });

  assert.deepEqual(snapshot.targetRoles, ["Software Engineer (C++)", "Simulation Engineer"]);
  assert.deepEqual(snapshot.preferredDomains, [
    "Aero spatiale et Defense",
    "Calcul haute performance",
    "Recherche scientifique",
  ]);
  assert.deepEqual(snapshot.preferredTechnologies, [
    "C++",
    "Python",
    "OpenGL",
    "Simulation numerique",
  ]);
  assert.deepEqual(snapshot.employmentTypes, ["INTERNSHIP"]);
  assert.deepEqual(snapshot.workModes, ["HYBRID"]);
  assert.equal(snapshot.hardConstraints.availabilityDate, "2026-09-01");
  assert.deepEqual(snapshot.evidence.enrichmentRoles, ["Physics Programmer"]);
  assert.deepEqual(snapshot.evidence.enrichmentKeywords, ["Temps reel"]);
});

test("defaultSearchPersonalizationGuardrails protects hard constraints from implicit overrides", () => {
  const lockedAxes = defaultSearchPersonalizationGuardrails
    .filter((guardrail) => guardrail.mode === "LOCK_EXPLICIT")
    .map((guardrail) => guardrail.axis);

  assert.deepEqual(lockedAxes, ["EMPLOYMENT_TYPE", "LOCATION", "WORK_MODE"]);
});

test("searchBehaviorEventCatalog covers explicit feedback and outcomes", () => {
  const eventTypes = new Set(searchBehaviorEventCatalog.map((item) => item.type));

  assert.equal(eventTypes.has("OFFER_FEEDBACK_FAVORITE"), true);
  assert.equal(eventTypes.has("OFFER_FEEDBACK_NOT_RELEVANT"), true);
  assert.equal(eventTypes.has("EMAIL_REPLY_RECEIVED"), true);
  assert.equal(eventTypes.has("OFFER_ACCEPTED_RECORDED"), true);
});
