import assert from "node:assert/strict";
import test from "node:test";

import { buildGoogleCalendarUrl } from "../../src/lib/applications/calendar";
import {
  DEFAULT_FOLLOW_UP_DELAY_DAYS,
  resolveFollowUpDate,
} from "../../src/lib/applications/pipeline";
import { applyResumeSuggestions } from "../../src/lib/profile/resume-suggestions";
import { extractResumeSuggestionsWithoutAi } from "../../src/lib/profile/resume-import";
import { findOfferExclusionReason } from "../../src/lib/search/matching";

const now = new Date("2026-10-30T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

test("entering 'applied' schedules a follow-up, later stages clear it", () => {
  assert.equal(
    resolveFollowUpDate({ stage: "APPLIED", requested: undefined, current: null, now })?.getTime(),
    now.getTime() + DEFAULT_FOLLOW_UP_DELAY_DAYS * DAY_MS,
  );

  const existing = new Date("2026-11-03T09:00:00Z");
  assert.equal(
    resolveFollowUpDate({ stage: "APPLIED", requested: undefined, current: existing, now }),
    existing,
  );
  assert.equal(resolveFollowUpDate({ stage: "INTERVIEWING", requested: undefined, current: existing, now }), null);
  assert.equal(resolveFollowUpDate({ stage: "REJECTED", requested: undefined, current: existing, now }), null);
  assert.equal(resolveFollowUpDate({ stage: undefined, requested: undefined, current: existing, now }), existing);
  assert.equal(resolveFollowUpDate({ stage: "INTERVIEWING", requested: existing, current: null, now }), existing);
  assert.equal(resolveFollowUpDate({ stage: "APPLIED", requested: null, current: existing, now }), null);
});

test("google calendar link carries title and UTC time range", () => {
  const url = new URL(
    buildGoogleCalendarUrl({
      title: "Entretien – Stage backend",
      details: "Acme",
      start: new Date("2026-11-02T09:30:00Z"),
      durationMinutes: 45,
    }),
  );

  assert.equal(url.hostname, "calendar.google.com");
  assert.equal(url.searchParams.get("text"), "Entretien – Stage backend");
  assert.equal(url.searchParams.get("dates"), "20261102T093000Z/20261102T101500Z");
});

const emptyForm = {
  headline: "",
  summary: "",
  school: "",
  degree: "",
  graduationYear: "",
  city: "",
  skills: "",
  targetRoles: "",
  languages: "",
  hasDrivingLicense: "",
};

const suggestions = {
  headline: "Étudiant ingénieur",
  summary: null,
  school: "INSA Lyon",
  degree: null,
  graduationYear: 2027,
  city: "Lyon",
  skills: ["TypeScript", "typescript", "Python"],
  targetRoles: ["Stage backend"],
  languages: ["Français", "Anglais"],
  hasDrivingLicense: true,
};

test("resume suggestions fill empty fields and merge lists without duplicates", () => {
  const { profile, filledFields } = applyResumeSuggestions(
    { ...emptyForm, headline: "Mon titre", skills: "Python, SQL" },
    suggestions,
  );

  assert.equal(profile.headline, "Mon titre");
  assert.equal(profile.school, "INSA Lyon");
  assert.equal(profile.graduationYear, "2027");
  assert.equal(profile.skills, "Python, SQL, TypeScript");
  assert.equal(profile.languages, "Français, Anglais");
  assert.equal(profile.hasDrivingLicense, "yes");
  assert.ok(!filledFields.includes("headline"));
  assert.ok(filledFields.includes("skills"));
});

test("resume keyword extraction finds languages and licence without AI", () => {
  const extracted = extractResumeSuggestionsWithoutAi(
    "Compétences : TypeScript, React, PostgreSQL. Langues : français, anglais courant, espagnol. Permis B.",
  );

  assert.deepEqual(extracted.languages, ["Français", "Anglais", "Espagnol"]);
  assert.equal(extracted.hasDrivingLicense, true);
  assert.ok(extracted.skills.length > 0);
});

function profileWith(constraints: { excludedSectors?: string[]; hasDrivingLicense?: boolean | null }) {
  return {
    personalProfile: {
      profile: {
        constraints: {
          excludedSectors: constraints.excludedSectors ?? [],
          hasDrivingLicense: constraints.hasDrivingLicense ?? null,
        },
      },
    },
  } as unknown as Parameters<typeof findOfferExclusionReason>[0];
}

const offer = (summary: string, title = "Stage développeur") => ({
  title,
  companyName: "Acme",
  summary,
  profileSnippet: null,
});

test("excluded sectors and missing licence remove offers", () => {
  assert.equal(
    findOfferExclusionReason(profileWith({ excludedSectors: ["Défense"] }), offer("Acteur de la défense aérienne")),
    "Secteur exclu : Défense",
  );
  assert.equal(
    findOfferExclusionReason(profileWith({ excludedSectors: ["tabac"] }), offer("Logiciel de tabacologie")),
    null,
  );
  assert.equal(
    findOfferExclusionReason(profileWith({ hasDrivingLicense: false }), offer("Permis B exigé pour les déplacements")),
    "Permis de conduire exigé",
  );
  assert.equal(
    findOfferExclusionReason(profileWith({ hasDrivingLicense: true }), offer("Permis B exigé")),
    null,
  );
  assert.equal(
    findOfferExclusionReason(profileWith({ hasDrivingLicense: false }), offer("Le permis B est un plus")),
    null,
  );
});
