import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPersonaOnboardingPayload,
  testPersonas,
} from "@/lib/testing/personas";

test("persona catalog spans multiple sectors without duplicate slugs", () => {
  const slugs = new Set(testPersonas.map((persona) => persona.slug));
  const sectors = new Set(testPersonas.map((persona) => persona.searchSector));
  const sectorText = testPersonas.map((persona) => persona.searchSector.toLowerCase());

  assert.equal(slugs.size, testPersonas.length);
  assert.ok(testPersonas.length >= 5);
  assert.ok(sectors.size >= 5);
  assert.ok(sectorText.some((sector) => sector.includes("sante")));
  assert.ok(sectorText.some((sector) => sector.includes("espaces verts")));
  assert.ok(sectorText.some((sector) => sector.includes("ressources humaines")));
});

test("persona onboarding payload exposes the search signals used by the app", () => {
  const persona = testPersonas[0];
  const payload = buildPersonaOnboardingPayload(persona);

  assert.equal(payload.fullName, `${persona.firstName} ${persona.lastName}`);
  assert.match(payload.skills, new RegExp(persona.hardSkills[0], "i"));
  assert.match(payload.targetRoles, new RegExp(persona.targetRoles[0], "i"));
  assert.match(payload.searchKeywords, new RegExp(persona.searchKeywords[0], "i"));
  assert.equal(payload.domainSelections.length, persona.preferredDomains.length);
});

test("persona catalog includes personality, preferred subsector and verification hooks", () => {
  for (const persona of testPersonas) {
    assert.ok(persona.preferredSubsector.length >= 8);
    assert.ok(persona.personality.length >= 20);
    assert.ok(persona.personalityTraits.length >= 3);
    assert.ok(persona.favoriteCompanies.length >= 2);
    assert.ok(persona.verificationChecklist.length >= 2);
    assert.ok(persona.verificationChecklist.every((criterion) => criterion.expectedSignals.length >= 2));
  }
});
