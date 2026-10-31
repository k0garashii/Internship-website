import type { SearchQueryCandidate } from "@/lib/search/query-plan";
import { cleanHumanText } from "@/lib/text/clean-text";

// Official job offers API (https://francetravail.io/data/api/offres-emploi).
const TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const OFFER_PAGE_URL = "https://candidat.francetravail.fr/offres/recherche/detail/";
const COMMUNE_LOOKUP_URL = "https://geo.api.gouv.fr/communes";
const SCOPE = "api_offresdemploiv2 o2dsoffre";
const REQUEST_TIMEOUT_MS = 9000;
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const PUBLISHED_WITHIN_DAYS = "31";
const NON_GEOGRAPHIC_LOCATIONS = new Set(["remote", "teletravail", "télétravail", "france", "europe"]);

type FranceTravailConfig = {
  clientId: string;
  clientSecret: string;
};

type FranceTravailRawOffer = {
  id?: string;
  intitule?: string;
  description?: string;
  dateCreation?: string;
  lieuTravail?: { libelle?: string };
  entreprise?: { nom?: string };
  typeContrat?: string;
  natureContrat?: string;
  alternance?: boolean;
  salaire?: { libelle?: string };
  origineOffre?: { urlOrigine?: string };
};

export type FranceTravailHit = {
  id: string;
  title: string;
  companyName: string;
  locationLabel: string | null;
  sourceUrl: string;
  publishedAt: string | null;
  description: string | null;
  contractType: string | null;
  salaryLabel: string | null;
};

let cachedToken: { value: string; expiresAt: number } | null = null;
const departmentCache = new Map<string, string | null>();

export function getFranceTravailConfig(): FranceTravailConfig | null {
  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET?.trim();

  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function getAccessToken(config: FranceTravailConfig) {
  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: SCOPE,
    }),
  });

  if (!response.ok) {
    throw new Error(`France Travail token request failed (${response.status})`);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };

  if (!payload.access_token) {
    throw new Error("France Travail token response has no access_token");
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 1500) * 1000,
  };

  return cachedToken.value;
}

// The search filters by département code, resolved from the city name with
// the official geo API. Unknown or non-geographic locations search nationwide.
async function resolveDepartmentCode(location: string | null) {
  const name = location?.trim();

  if (!name || NON_GEOGRAPHIC_LOCATIONS.has(name.toLowerCase())) {
    return null;
  }

  if (departmentCache.has(name)) {
    return departmentCache.get(name) ?? null;
  }

  try {
    const url = new URL(COMMUNE_LOOKUP_URL);
    url.searchParams.set("nom", name);
    url.searchParams.set("fields", "codeDepartement");
    url.searchParams.set("boost", "population");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const communes = response.ok ? ((await response.json()) as Array<{ codeDepartement?: string }>) : [];
    const code = communes[0]?.codeDepartement ?? null;

    departmentCache.set(name, code);
    return code;
  } catch {
    return null;
  }
}

export function mapFranceTravailContractType(offer: Pick<FranceTravailRawOffer, "alternance" | "natureContrat" | "typeContrat">) {
  if (offer.alternance || /apprentissage|professionnalisation/i.test(offer.natureContrat ?? "")) {
    return "apprenticeship";
  }

  switch (offer.typeContrat) {
    case "CDI":
      return "full_time";
    case "CDD":
    case "MIS":
    case "SAI":
      return "temporary";
    case "LIB":
    case "FRA":
      return "freelance";
    default:
      return null;
  }
}

export function mapFranceTravailOffer(offer: FranceTravailRawOffer): FranceTravailHit | null {
  if (!offer.id || !offer.intitule) {
    return null;
  }

  return {
    id: offer.id,
    title: offer.intitule,
    companyName: offer.entreprise?.nom?.trim() || "Entreprise non communiquée",
    locationLabel: offer.lieuTravail?.libelle ?? null,
    // The France Travail page is stable; the partner origin link is not always present.
    sourceUrl: `${OFFER_PAGE_URL}${encodeURIComponent(offer.id)}`,
    publishedAt: offer.dateCreation ?? null,
    description: cleanHumanText(offer.description)?.slice(0, 1200) ?? null,
    contractType: mapFranceTravailContractType(offer),
    salaryLabel: offer.salaire?.libelle ?? null,
  };
}

export async function searchFranceTravailOffers(
  config: FranceTravailConfig,
  query: SearchQueryCandidate,
  hitsPerQuery: number,
) {
  const [token, departmentCode] = await Promise.all([
    getAccessToken(config),
    resolveDepartmentCode(query.location),
  ]);
  const url = new URL(SEARCH_URL);

  url.searchParams.set("motsCles", query.targetRole);
  url.searchParams.set("publieeDepuis", PUBLISHED_WITHIN_DAYS);
  url.searchParams.set("range", `0-${Math.max(1, hitsPerQuery) - 1}`);

  if (departmentCode) {
    url.searchParams.set("departement", departmentCode);
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });

  // 204: no result; 206: partial content (more pages exist).
  if (response.status === 204) {
    return { departmentCode, hits: [] as FranceTravailHit[] };
  }

  if (!response.ok) {
    throw new Error(`France Travail search failed (${response.status})`);
  }

  const payload = (await response.json()) as { resultats?: FranceTravailRawOffer[] };

  return {
    departmentCode,
    hits: (payload.resultats ?? [])
      .map((offer) => mapFranceTravailOffer(offer))
      .filter((hit): hit is FranceTravailHit => hit !== null),
  };
}
