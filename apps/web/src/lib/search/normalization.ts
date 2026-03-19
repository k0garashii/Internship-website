import { createHash } from "node:crypto";

import type {
  NormalizedOpportunity,
  SearchDiscoveryOffer,
} from "@/lib/search/types";

type InboundEmailNormalizationInput = {
  id: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  canonicalUrl: string | null;
  snippet: string | null;
  bodyPreview: string | null;
  receivedAt: string;
  signal: string;
};

function buildFingerprint(values: Array<string | null | undefined>) {
  return createHash("sha1")
    .update(values.filter(Boolean).join("|"))
    .digest("hex");
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function normalizeDiscoveryOffer(
  offer: SearchDiscoveryOffer,
  capturedAt: string,
): NormalizedOpportunity {
  const description = normalizeText(offer.summary ?? offer.profileSnippet);

  return {
    id: `normalized:${offer.id}`,
    rawSourceId: offer.id,
    fingerprint: buildFingerprint([
      offer.provider,
      offer.sourceUrl,
      offer.companyName,
      offer.title,
      offer.locationLabel,
    ]),
    origin: "WEB_DISCOVERY",
    sourceKind: offer.sourceKind,
    sourceProvider: offer.provider,
    sourceLabel: offer.sourceSite,
    title: normalizeText(offer.title),
    companyName: normalizeText(offer.companyName),
    locationLabel: normalizeText(offer.locationLabel),
    countryCode: normalizeText(offer.countryCode),
    contractType: normalizeText(offer.contractType),
    workMode: normalizeText(offer.remoteMode),
    description,
    sourceUrl: offer.sourceUrl,
    publishedAt: offer.publishedAt,
    capturedAt,
    signal: null,
  };
}

export function normalizeDiscoveryOffers(
  offers: SearchDiscoveryOffer[],
  capturedAt: string,
) {
  return offers.map((offer) => normalizeDiscoveryOffer(offer, capturedAt));
}

export function normalizeInboundEmailOpportunityPreview(
  email: InboundEmailNormalizationInput,
): NormalizedOpportunity {
  return {
    id: `normalized:email:${email.id}`,
    rawSourceId: email.id,
    fingerprint: buildFingerprint([
      "forwarding",
      email.canonicalUrl,
      email.fromEmail,
      email.subject,
    ]),
    origin: "INBOUND_EMAIL",
    sourceKind: "INBOUND_EMAIL",
    sourceProvider: "forwarding",
    sourceLabel: "Forwarding dedie",
    title: normalizeText(email.subject),
    companyName: normalizeText(email.fromName ?? email.fromEmail),
    locationLabel: null,
    countryCode: null,
    contractType: null,
    workMode: null,
    description: normalizeText(email.snippet ?? email.bodyPreview),
    sourceUrl: email.canonicalUrl,
    publishedAt: email.receivedAt,
    capturedAt: email.receivedAt,
    signal: email.signal,
  };
}
