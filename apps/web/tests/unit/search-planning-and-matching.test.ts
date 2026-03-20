import assert from "node:assert/strict";
import test from "node:test";

import { getPersonalProfileExample } from "../../src/lib/config/personal-profile";
import {
  getSearchTargetsExample,
  searchTargetsFileSchema,
} from "../../src/lib/config/search-targets";
import { matchProfileToOffer } from "../../src/lib/search/matching";
import { buildSearchQueryPlan } from "../../src/lib/search/query-plan";
import type { SearchDiscoveryOffer } from "../../src/lib/search/types";

test("query plan rotates roles before repeating the first combination", () => {
  const personalProfile = getPersonalProfileExample();
  const searchTargets = searchTargetsFileSchema.parse({
    ...getSearchTargetsExample(),
    targets: [
      {
        title: "Backend Engineer Intern",
        employmentTypes: ["INTERNSHIP"],
        priority: 90,
        isActive: true,
      },
      {
        title: "Platform Engineer Intern",
        employmentTypes: ["INTERNSHIP"],
        priority: 80,
        isActive: true,
      },
      {
        title: "Developer Productivity Intern",
        employmentTypes: ["INTERNSHIP"],
        priority: 70,
        isActive: true,
      },
    ],
  });

  const plan = buildSearchQueryPlan(personalProfile, searchTargets);
  const firstRoles = plan.queries.slice(0, 3).map((query) => query.targetRole);

  assert.deepEqual(firstRoles, [
    "Backend Engineer Intern",
    "Platform Engineer Intern",
    "Developer Productivity Intern",
  ]);
});

test("matching gives a stronger score to offers aligned with the profile and query signals", () => {
  const personalProfile = getPersonalProfileExample();
  const searchTargets = getSearchTargetsExample();
  const config = {
    personalProfile,
    searchTargets,
  };

  const relevantOffer: SearchDiscoveryOffer = {
    id: "offer_relevant",
    provider: "wttj",
    sourceKind: "JOB_BOARD",
    sourceSite: "Welcome to the Jungle",
    title: "Backend Engineer Intern - TypeScript APIs",
    companyName: "Acme",
    companySlug: "acme",
    locationLabel: "Paris",
    countryCode: "FR",
    contractType: "internship",
    remoteMode: "partial",
    publishedAt: "2026-03-20T10:00:00.000Z",
    sourceUrl: "https://example.com/relevant",
    summary:
      "Stage backend TypeScript, Node.js, APIs, automation et outils developpeur.",
    profileSnippet: "Node.js TypeScript automation platform engineering",
    matchedQueryIds: ["q1", "q2"],
    matchedQueryLabels: [
      "Backend Engineer Intern - Developer Tools",
      "Platform Engineer Intern - SaaS B2B",
    ],
    matchedKeywords: ["TypeScript", "Node.js", "automation"],
    priorityScore: 92,
    relevanceScore: 94,
    relevanceLabel: "Tres forte",
    matching: {
      score: 0,
      label: "Exploratoire",
      summary: "",
      breakdown: [],
    },
  };

  const weakOffer: SearchDiscoveryOffer = {
    ...relevantOffer,
    id: "offer_weak",
    title: "Sales Operations Intern",
    companyName: "OtherCo",
    locationLabel: "Madrid",
    summary: "Support commercial et reporting CRM.",
    profileSnippet: "sales operations pipeline reporting",
    matchedQueryIds: ["q3"],
    matchedQueryLabels: ["Generic internship"],
    matchedKeywords: [],
    priorityScore: 45,
    sourceUrl: "https://example.com/weak",
  };

  const strongMatch = matchProfileToOffer(config, relevantOffer);
  const weakMatch = matchProfileToOffer(config, weakOffer);

  assert.ok(strongMatch.score > weakMatch.score);
  assert.ok(strongMatch.score >= 70);
  assert.ok(
    strongMatch.breakdown.some((item) => item.criterion === "Convergence requetes"),
  );
  assert.ok(
    strongMatch.breakdown.some((item) => item.criterion === "Priorite utilisateur"),
  );
});
