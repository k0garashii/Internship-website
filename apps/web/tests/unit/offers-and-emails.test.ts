import assert from "node:assert/strict";
import test from "node:test";

import { InboundEmailSignal, InboundEmailStatus } from "@prisma/client";

import { parseInboundEmailOpportunity } from "../../src/lib/email/opportunities";
import { buildOfferScoreLabel, scoreDiscoveryOffer } from "../../src/lib/search/scoring";
import { cleanHumanText, isHumanReadableSnippet } from "../../src/lib/text/clean-text";

const DAY_MS = 24 * 60 * 60 * 1000;

function buildOffer(overrides: Partial<Parameters<typeof scoreDiscoveryOffer>[0]> = {}) {
  return {
    contractType: null,
    matchedKeywords: [],
    matchedQueryIds: [],
    profileSnippet: null,
    publishedAt: null,
    summary: null,
    ...overrides,
  } as Parameters<typeof scoreDiscoveryOffer>[0];
}

function buildEmail(
  overrides: Partial<Parameters<typeof parseInboundEmailOpportunity>[0]> = {},
): Parameters<typeof parseInboundEmailOpportunity>[0] {
  return {
    id: "email_1",
    fromName: null,
    fromEmail: null,
    subject: null,
    bodyPreview: null,
    snippet: null,
    canonicalUrl: null,
    signal: InboundEmailSignal.UNKNOWN,
    receivedAt: new Date("2026-10-01T09:00:00Z"),
    ...overrides,
  };
}

test("offer score stays within bounds and labels follow thresholds", () => {
  const empty = scoreDiscoveryOffer(buildOffer());
  const loaded = scoreDiscoveryOffer(
    buildOffer({
      contractType: "internship",
      matchedKeywords: ["a", "b", "c", "d", "e", "f"],
      matchedQueryIds: ["q1", "q2", "q3"],
      profileSnippet: "Profil",
      summary: "Resume",
      publishedAt: new Date(Date.now() - DAY_MS).toISOString(),
    }),
  );

  assert.equal(empty.score, 36);
  assert.equal(empty.label, "Exploratoire");
  assert.equal(loaded.score, 98);
  assert.equal(loaded.label, "Tres forte");
  assert.equal(buildOfferScoreLabel(85), "Tres forte");
  assert.equal(buildOfferScoreLabel(72), "Forte");
  assert.equal(buildOfferScoreLabel(58), "Intermediaire");
  assert.equal(buildOfferScoreLabel(57), "Exploratoire");
});

test("offer score rewards relevance signals and freshness monotonically", () => {
  const base = scoreDiscoveryOffer(buildOffer({ matchedQueryIds: ["q1"] })).score;
  const withKeywords = scoreDiscoveryOffer(
    buildOffer({ matchedQueryIds: ["q1"], matchedKeywords: ["typescript", "backend"] }),
  ).score;
  const withInternship = scoreDiscoveryOffer(
    buildOffer({ matchedQueryIds: ["q1"], contractType: "internship" }),
  ).score;
  const fresh = scoreDiscoveryOffer(
    buildOffer({ publishedAt: new Date(Date.now() - 2 * DAY_MS).toISOString() }),
  ).score;
  const older = scoreDiscoveryOffer(
    buildOffer({ publishedAt: new Date(Date.now() - 30 * DAY_MS).toISOString() }),
  ).score;
  const stale = scoreDiscoveryOffer(
    buildOffer({ publishedAt: new Date(Date.now() - 90 * DAY_MS).toISOString() }),
  ).score;

  assert.ok(withKeywords > base);
  assert.ok(withInternship > base);
  assert.ok(fresh > older);
  assert.ok(older > stale);
});

test("application acknowledgements are ignored, including accented subjects", () => {
  for (const subject of ["Candidature reçue", "Merci pour votre candidature", "Application received"]) {
    const parsed = parseInboundEmailOpportunity(buildEmail({ subject }));

    assert.equal(parsed.processingStatus, InboundEmailStatus.IGNORED, subject);
    assert.equal(parsed.normalizedOpportunity, null, subject);
  }

  const update = parseInboundEmailOpportunity(
    buildEmail({ subject: "Nouvelle offre", signal: InboundEmailSignal.APPLICATION_UPDATE }),
  );
  assert.equal(update.processingStatus, InboundEmailStatus.IGNORED);
});

test("empty or unrelated emails are not projected as opportunities", () => {
  assert.equal(
    parseInboundEmailOpportunity(buildEmail()).processingStatus,
    InboundEmailStatus.IGNORED,
  );
});

test("job alerts are parsed into a normalized opportunity", () => {
  const parsed = parseInboundEmailOpportunity(
    buildEmail({
      fromName: "LinkedIn Job Alerts",
      fromEmail: "jobalerts-noreply@linkedin.com",
      subject: "Stage développeur backend chez Acme",
      snippet: "Acme recrute un stagiaire backend TypeScript à Paris.",
      canonicalUrl: "https://www.linkedin.com/jobs/view/123456",
      signal: InboundEmailSignal.JOB_ALERT,
    }),
  );

  assert.equal(parsed.processingStatus, InboundEmailStatus.PARSED);
  assert.ok(parsed.normalizedOpportunity);
});

test("human text cleaning strips markup, entities and attribute noise", () => {
  assert.equal(cleanHumanText(null), null);
  assert.equal(cleanHumanText("   "), null);
  assert.equal(
    cleanHumanText("<p>Stage&nbsp;<strong>Backend</strong> &amp; API</p>"),
    "Stage Backend & API",
  );
  assert.equal(isHumanReadableSnippet('<a href="https://x.test">x</a>'), false);
  assert.equal(isHumanReadableSnippet("Une équipe produit cherche un stagiaire backend."), true);
});
