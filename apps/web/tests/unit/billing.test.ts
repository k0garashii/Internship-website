import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { SubscriptionStatus } from "@prisma/client";

import {
  readSubscriptionPeriodEnd,
  StripeWebhookError,
  verifyStripeWebhook,
} from "../../src/lib/billing/stripe";
import {
  mapFranceTravailContractType,
  mapFranceTravailOffer,
} from "../../src/lib/search/providers/france-travail";
import { mapStripeSubscriptionStatus } from "../../src/server/application/billing/stripe-billing-service";
import { startOfUsagePeriod } from "../../src/server/application/entitlements/feature-usage-service";
import { getPlanDefinition } from "../../src/server/domain/billing/plan-catalog";

const secret = "whsec_test_secret";
const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });
const now = 1_793_500_000;

function sign(payload: string, timestamp: number, key = secret) {
  return createHmac("sha256", key).update(`${timestamp}.${payload}`).digest("hex");
}

test("stripe webhook signatures are verified like the official SDK", () => {
  const header = `t=${now},v1=${sign(body, now)}`;

  assert.equal(verifyStripeWebhook(body, header, secret, now).id, "evt_1");
  assert.equal(
    verifyStripeWebhook(body, `t=${now},v1=deadbeef,v1=${sign(body, now)}`, secret, now).type,
    "customer.subscription.updated",
  );
  assert.throws(() => verifyStripeWebhook(`${body} `, header, secret, now), StripeWebhookError);
  assert.throws(() => verifyStripeWebhook(body, `t=${now},v1=${sign(body, now, "other")}`, secret, now), StripeWebhookError);
  assert.throws(() => verifyStripeWebhook(body, header, secret, now + 301), StripeWebhookError);
  assert.throws(() => verifyStripeWebhook(body, null, secret, now), StripeWebhookError);
  assert.throws(() => verifyStripeWebhook(body, "garbage", secret, now), StripeWebhookError);
});

test("stripe statuses map to subscription access states", () => {
  assert.equal(mapStripeSubscriptionStatus("active"), SubscriptionStatus.ACTIVE);
  assert.equal(mapStripeSubscriptionStatus("trialing"), SubscriptionStatus.TRIALING);
  assert.equal(mapStripeSubscriptionStatus("past_due"), SubscriptionStatus.PAST_DUE);
  assert.equal(mapStripeSubscriptionStatus("unpaid"), SubscriptionStatus.PAST_DUE);
  assert.equal(mapStripeSubscriptionStatus("canceled"), SubscriptionStatus.CANCELED);
  assert.equal(mapStripeSubscriptionStatus("incomplete"), SubscriptionStatus.EXPIRED);
});

test("subscription period end is read from the subscription or its first item", () => {
  const base = { id: "sub", customer: "cus", status: "active", cancel_at_period_end: false };

  assert.equal(readSubscriptionPeriodEnd({ ...base, current_period_end: 1_800_000_000 })?.getTime(), 1_800_000_000_000);
  assert.equal(
    readSubscriptionPeriodEnd({ ...base, items: { data: [{ current_period_end: 1_800_000_100 }] } })?.getTime(),
    1_800_000_100_000,
  );
  assert.equal(readSubscriptionPeriodEnd(base), null);
});

test("plans: free has a monthly AI quota, pro is unlimited with extended sources", () => {
  const free = getPlanDefinition("FREE");
  const pro = getPlanDefinition("PRO");

  assert.equal(free?.featureMatrix.AI_GENERATION.limitValue, 10);
  assert.equal(free?.featureMatrix.EXTENDED_SOURCES.enabled, false);
  assert.equal(pro?.featureMatrix.AI_GENERATION.limitValue, null);
  assert.equal(pro?.featureMatrix.EXTENDED_SOURCES.enabled, true);
  assert.equal(pro?.priceCents, 499);
  assert.equal(startOfUsagePeriod(new Date("2026-10-31T23:59:00Z")).toISOString(), "2026-10-01T00:00:00.000Z");
});

test("france travail offers are mapped to discovery hits", () => {
  const hit = mapFranceTravailOffer({
    id: "201ABCD",
    intitule: "Développeur web en alternance (H/F)",
    description: "<p>Rejoins notre équipe&nbsp;!</p>",
    dateCreation: "2026-10-20T10:00:00.000Z",
    lieuTravail: { libelle: "69 - LYON 03" },
    entreprise: { nom: "Acme" },
    typeContrat: "CDD",
    alternance: true,
  });

  assert.ok(hit);
  assert.equal(hit.sourceUrl, "https://candidat.francetravail.fr/offres/recherche/detail/201ABCD");
  assert.equal(hit.contractType, "apprenticeship");
  assert.equal(hit.description, "Rejoins notre équipe !");
  assert.equal(mapFranceTravailOffer({ intitule: "Sans id" }), null);
  assert.equal(mapFranceTravailContractType({ typeContrat: "CDI" }), "full_time");
  assert.equal(mapFranceTravailContractType({ typeContrat: "MIS" }), "temporary");
  assert.equal(mapFranceTravailContractType({ natureContrat: "Contrat apprentissage" }), "apprenticeship");
});
