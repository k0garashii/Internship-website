import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyDigest } from "../../src/server/application/alerts/daily-digest";
import { detectOfferAvailability } from "../../src/server/application/alerts/offer-availability";

const baseDigest = {
  firstName: "Sasha",
  appBaseUrl: "https://app.example",
  newOffers: [],
  followUpsDue: [],
  upcomingInterviews: [],
  expiredOfferCount: 0,
};

test("no digest is produced when there is nothing new", () => {
  assert.equal(buildDailyDigest(baseDigest), null);
  assert.equal(buildDailyDigest({ ...baseDigest, expiredOfferCount: 3 }), null);
});

test("digest lists offers, follow-ups and interviews with a summary subject", () => {
  const digest = buildDailyDigest({
    ...baseDigest,
    newOffers: [
      {
        title: "Stage backend",
        companyName: "Acme",
        locationLabel: "Paris",
        scorePercent: 82,
        url: "https://app.example/workspace/search/offers/1",
      },
    ],
    followUpsDue: [{ title: "Alternance data", companyName: "Beta", date: new Date() }],
    upcomingInterviews: [
      { title: "Stage produit", companyName: "Gamma", date: new Date("2026-11-02T09:30:00Z") },
    ],
    expiredOfferCount: 2,
  });

  assert.ok(digest);
  assert.equal(digest.subject, "Ta recherche du jour : 1 nouvelle offre, 1 relance, 1 entretien");
  assert.match(digest.text, /^Bonjour Sasha,/);
  assert.match(digest.text, /Stage backend \(Acme · Paris · match 82 %\)/);
  assert.match(digest.text, /Alternance data chez Beta/);
  assert.match(digest.text, /Stage produit chez Gamma, lundi 2 novembre/);
  assert.match(digest.text, /2 offres suivies ont expiré/);
  assert.match(digest.text, /https:\/\/app\.example\/workspace\/profile/);
});

test("offer availability only reports expired on clear signals", () => {
  assert.equal(detectOfferAvailability(404, null), "expired");
  assert.equal(detectOfferAvailability(410, null), "expired");
  assert.equal(detectOfferAvailability(403, null), "unknown");
  assert.equal(detectOfferAvailability(429, null), "unknown");
  assert.equal(detectOfferAvailability(500, null), "unknown");
  assert.equal(detectOfferAvailability(200, "<h1>Stage backend</h1><p>Postuler</p>"), "available");
  assert.equal(detectOfferAvailability(200, "<p>Cette offre n’est plus disponible.</p>"), "expired");
  assert.equal(detectOfferAvailability(200, "<p>Le poste a été pourvu</p>"), "expired");
  assert.equal(detectOfferAvailability(200, "No longer accepting applications"), "expired");
  assert.equal(detectOfferAvailability(200, "This job has expired"), "expired");
});
