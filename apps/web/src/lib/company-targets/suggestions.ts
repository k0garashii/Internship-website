import { z } from "zod";

import {
  normalizeCompanyName,
  type CompanyWatchlistFile,
} from "@/lib/config/company-watchlist";
import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
import { normalizeListItem } from "@/lib/profile/schema";

const optionalUrlSchema = z
  .union([z.url(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null))
  .default(null);

export const companyTargetSuggestionItemSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  websiteUrl: optionalUrlSchema,
  careerPageUrl: optionalUrlSchema,
  notes: z
    .union([z.string().trim().max(240), z.literal(""), z.null(), z.undefined()])
    .transform((value) => value || null)
    .default(null),
  rationale: z.string().trim().min(8).max(320),
  priority: z.number().int().min(0).max(100),
  tags: z.array(z.string().trim().min(2).max(80)).max(8).default([]),
  matchedSignals: z.array(z.string().trim().min(2).max(80)).max(8).default([]),
});

const companyTargetSuggestionSchema = z.object({
  summary: z.string().trim().min(1).max(400),
  suggestions: z.array(companyTargetSuggestionItemSchema).min(1).max(12),
});

export type CompanyTargetSuggestionResult = z.output<typeof companyTargetSuggestionSchema> & {
  provider: "gemini" | "fallback";
};
export type CompanyTargetSuggestionItem = z.output<typeof companyTargetSuggestionItemSchema>;

type CompanyCatalogEntry = {
  companyName: string;
  websiteUrl: string | null;
  careerPageUrl: string | null;
  notes: string;
  locationTokens: string[];
  countryCodes: string[];
  domainTokens: string[];
  roleTokens: string[];
  keywordTokens: string[];
  tags: string[];
  earlyCareerFriendly: boolean;
};

type UserSignals = {
  fullText: string;
  locationText: string;
  targetRoleText: string;
  domainText: string;
  countryCodes: string[];
  experienceLevel: string | null;
};

const companyCatalog: CompanyCatalogEntry[] = [
  {
    companyName: "CEA",
    websiteUrl: "https://www.cea.fr",
    careerPageUrl: null,
    notes: "Organisme de recherche et d ingenierie avec de nombreuses offres publiees sur ses canaux propres.",
    locationTokens: ["paris", "saclay", "ile-de-france", "france"],
    countryCodes: ["FR"],
    domainTokens: ["research", "r&d", "deep tech", "cyber", "data", "platform", "software products"],
    roleTokens: ["backend", "software", "platform", "data", "cybersecurity"],
    keywordTokens: ["typescript", "python", "data", "simulation", "security", "backend", "api"],
    tags: ["Recherche", "Paris-Saclay", "Deep Tech"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Inria",
    websiteUrl: "https://www.inria.fr",
    careerPageUrl: null,
    notes: "Institut de recherche informatique pertinent pour les profils software, data et systemes.",
    locationTokens: ["paris", "saclay", "france", "rennes", "lille", "grenoble"],
    countryCodes: ["FR"],
    domainTokens: ["research", "data", "ai", "cloud", "cyber", "developer tools"],
    roleTokens: ["backend", "research engineer", "software", "platform", "data"],
    keywordTokens: ["python", "typescript", "distributed systems", "api", "research", "ml"],
    tags: ["Recherche", "Informatique", "France"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Dassault Systemes",
    websiteUrl: "https://www.3ds.com",
    careerPageUrl: null,
    notes: "Acteur logiciel industriel avec des opportunites backend, plateforme et simulation souvent diffusees hors agregateurs generalistes.",
    locationTokens: ["paris", "velizy", "france"],
    countryCodes: ["FR"],
    domainTokens: ["software products", "saas b2b", "cloud", "deep tech"],
    roleTokens: ["backend", "platform", "software engineer", "fullstack"],
    keywordTokens: ["typescript", "node", "api", "cloud", "platform"],
    tags: ["Logiciel", "Industrie", "France"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "OVHcloud",
    websiteUrl: "https://www.ovhcloud.com",
    careerPageUrl: null,
    notes: "Bonne cible pour des profils cloud, plateforme et backend avec une forte couche infrastructure.",
    locationTokens: ["france", "paris", "lille", "remote"],
    countryCodes: ["FR"],
    domainTokens: ["cloud & platform", "developer tools", "saas b2b"],
    roleTokens: ["backend", "platform", "devops", "site reliability"],
    keywordTokens: ["cloud", "kubernetes", "api", "node", "typescript", "infra"],
    tags: ["Cloud", "Plateforme", "France"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Alan",
    websiteUrl: "https://alan.com",
    careerPageUrl: null,
    notes: "Scale-up produit B2B europeenne souvent pertinente pour un profil backend TypeScript et automatisation.",
    locationTokens: ["paris", "france", "remote", "europe"],
    countryCodes: ["FR"],
    domainTokens: ["saas b2b", "software products", "developer tools"],
    roleTokens: ["backend", "fullstack", "platform"],
    keywordTokens: ["typescript", "node", "api", "automation", "prisma"],
    tags: ["Scale-up", "SaaS", "Paris"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Doctolib",
    websiteUrl: "https://www.doctolib.com",
    careerPageUrl: null,
    notes: "Entreprise produit avec volume d offres souvent plus riche sur ses canaux proprietaires.",
    locationTokens: ["paris", "france", "nantes", "berlin"],
    countryCodes: ["FR", "DE"],
    domainTokens: ["saas b2b", "software products", "healthtech"],
    roleTokens: ["backend", "platform", "software engineer"],
    keywordTokens: ["typescript", "node", "api", "postgresql", "backend"],
    tags: ["Healthtech", "Produit", "Europe"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Qonto",
    websiteUrl: "https://qonto.com",
    careerPageUrl: null,
    notes: "Fintech B2B avec stack produit moderne et nombreuses offres software directes.",
    locationTokens: ["paris", "france", "europe", "remote"],
    countryCodes: ["FR"],
    domainTokens: ["fintech", "saas b2b", "software products"],
    roleTokens: ["backend", "platform", "software engineer"],
    keywordTokens: ["typescript", "node", "api", "postgresql", "payment"],
    tags: ["Fintech", "Paris", "Produit"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Datadog",
    websiteUrl: "https://www.datadoghq.com",
    careerPageUrl: null,
    notes: "Cible forte pour observabilite, plateforme, cloud et outils pour developpeurs.",
    locationTokens: ["paris", "france", "remote", "new york"],
    countryCodes: ["FR", "US"],
    domainTokens: ["developer tools", "cloud & platform", "saas b2b"],
    roleTokens: ["backend", "platform", "site reliability", "software engineer"],
    keywordTokens: ["cloud", "observability", "api", "backend", "go", "typescript"],
    tags: ["Developer Tools", "Observabilite", "Cloud"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Hugging Face",
    websiteUrl: "https://huggingface.co",
    careerPageUrl: null,
    notes: "Entreprise tres pertinente pour des profils data, AI tooling et plateformes developpeurs.",
    locationTokens: ["paris", "france", "remote", "new york"],
    countryCodes: ["FR", "US"],
    domainTokens: ["data & ai", "developer tools", "research"],
    roleTokens: ["backend", "platform", "machine learning", "software engineer"],
    keywordTokens: ["python", "ai", "machine learning", "llm", "api", "platform"],
    tags: ["AI", "Developer Tools", "Paris"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Mistral AI",
    websiteUrl: "https://mistral.ai",
    careerPageUrl: null,
    notes: "Cible deep tech pour profils AI, infra et plateforme logicielle.",
    locationTokens: ["paris", "france"],
    countryCodes: ["FR"],
    domainTokens: ["data & ai", "deep tech", "cloud & platform"],
    roleTokens: ["backend", "platform", "machine learning", "software engineer"],
    keywordTokens: ["llm", "ai", "python", "distributed systems", "backend", "platform"],
    tags: ["AI", "Deep Tech", "Paris"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Thales",
    websiteUrl: "https://www.thalesgroup.com",
    careerPageUrl: null,
    notes: "Groupe industriel avec offres cyber, defense, systemes embarques et logiciels publiees sur ses portails propres.",
    locationTokens: ["paris", "palaiseau", "saclay", "france"],
    countryCodes: ["FR"],
    domainTokens: ["cyber", "deep tech", "research", "industrial software"],
    roleTokens: ["backend", "software engineer", "cybersecurity", "embedded"],
    keywordTokens: ["security", "backend", "api", "python", "c++", "data"],
    tags: ["Cyber", "Industrie", "France"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Schneider Electric",
    websiteUrl: "https://www.se.com",
    careerPageUrl: null,
    notes: "Bon point d entree pour industrie logicielle, energie et data/plateforme.",
    locationTokens: ["france", "paris", "grenoble"],
    countryCodes: ["FR"],
    domainTokens: ["industrial software", "climate tech", "cloud & platform", "data & ai"],
    roleTokens: ["backend", "platform", "software engineer", "data"],
    keywordTokens: ["api", "data", "cloud", "backend", "python"],
    tags: ["Energie", "Industrie", "Data"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Contentsquare",
    websiteUrl: "https://contentsquare.com",
    careerPageUrl: null,
    notes: "Scale-up data produit interessante pour backend, analytics et plateformes internes.",
    locationTokens: ["paris", "france", "remote"],
    countryCodes: ["FR"],
    domainTokens: ["saas b2b", "data & ai", "software products"],
    roleTokens: ["backend", "platform", "software engineer", "data"],
    keywordTokens: ["typescript", "node", "data", "analytics", "api"],
    tags: ["Analytics", "Scale-up", "Paris"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Back Market",
    websiteUrl: "https://www.backmarket.com",
    careerPageUrl: null,
    notes: "Entreprise produit europeenne avec opportunites backend et plateforme hors canaux LinkedIn.",
    locationTokens: ["paris", "france", "remote"],
    countryCodes: ["FR"],
    domainTokens: ["software products", "marketplace", "saas b2b"],
    roleTokens: ["backend", "platform", "software engineer"],
    keywordTokens: ["typescript", "node", "api", "postgresql", "backend"],
    tags: ["Marketplace", "Produit", "Paris"],
    earlyCareerFriendly: true,
  },
  {
    companyName: "Deezer",
    websiteUrl: "https://www.deezer.com",
    careerPageUrl: null,
    notes: "Exemple concret de source proprietaire utile pour un profil software a Paris.",
    locationTokens: ["paris", "france"],
    countryCodes: ["FR"],
    domainTokens: ["software products", "data & ai"],
    roleTokens: ["backend", "platform", "software engineer"],
    keywordTokens: ["typescript", "backend", "api", "data"],
    tags: ["Produit", "Paris", "Media Tech"],
    earlyCareerFriendly: true,
  },
];

function uniqueList(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => (typeof value === "string" ? normalizeListItem(value) : "")).filter(Boolean)),
  );
}

function buildUserSignals(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
): UserSignals {
  const fullText = [
    personalProfile.profile.headline,
    personalProfile.profile.summary,
    ...personalProfile.profile.skills,
    ...searchTargets.targets.map((target) => target.title),
    ...searchTargets.keywords,
    ...searchTargets.preferredDomains.map((domain) => domain.label),
    ...searchTargets.preferredLocations.map((location) => location.label),
    personalProfile.profile.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    fullText,
    locationText: uniqueList([
      personalProfile.profile.city,
      ...searchTargets.preferredLocations.map((location) => location.label),
    ])
      .join(" ")
      .toLowerCase(),
    targetRoleText: uniqueList([
      personalProfile.profile.headline,
      ...searchTargets.targets.map((target) => target.title),
    ])
      .join(" ")
      .toLowerCase(),
    domainText: uniqueList(searchTargets.preferredDomains.map((domain) => domain.label))
      .join(" ")
      .toLowerCase(),
    countryCodes: uniqueList([
      personalProfile.profile.countryCode,
      ...searchTargets.preferredLocations.map((location) => location.countryCode),
    ]).map((value) => value.toUpperCase()),
    experienceLevel: personalProfile.profile.experienceLevel,
  };
}

function collectMatches(tokens: string[], text: string) {
  return uniqueList(tokens.filter((token) => text.includes(token.toLowerCase())));
}

function scoreEntry(entry: CompanyCatalogEntry, signals: UserSignals) {
  const domainMatches = collectMatches(entry.domainTokens, signals.domainText || signals.fullText);
  const roleMatches = collectMatches(entry.roleTokens, signals.targetRoleText || signals.fullText);
  const keywordMatches = collectMatches(entry.keywordTokens, signals.fullText);
  const locationMatches = collectMatches(entry.locationTokens, signals.locationText);
  const countryMatch = entry.countryCodes.some((code) => signals.countryCodes.includes(code));
  const earlyCareerBoost =
    entry.earlyCareerFriendly &&
    ["INTERN", "ENTRY_LEVEL", "JUNIOR"].includes(signals.experienceLevel ?? "");

  const score =
    domainMatches.length * 16 +
    roleMatches.length * 12 +
    Math.min(keywordMatches.length, 4) * 6 +
    Math.min(locationMatches.length, 2) * 7 +
    (countryMatch ? 8 : 0) +
    (earlyCareerBoost ? 8 : 0);

  return {
    score,
    matchedSignals: uniqueList([
      ...domainMatches,
      ...roleMatches,
      ...keywordMatches,
      ...locationMatches,
      ...(countryMatch ? signals.countryCodes : []),
    ]).slice(0, 8),
    reasons: uniqueList([
      domainMatches.length > 0 ? `alignement domaine: ${domainMatches.join(", ")}` : null,
      roleMatches.length > 0 ? `coherence avec les roles: ${roleMatches.join(", ")}` : null,
      keywordMatches.length > 0 ? `mots cles detectes: ${keywordMatches.join(", ")}` : null,
      locationMatches.length > 0 ? `presence geographique: ${locationMatches.join(", ")}` : null,
      countryMatch ? "presence dans les zones cibles" : null,
      earlyCareerBoost ? "structure pertinente pour un profil en debut de parcours" : null,
    ]),
  };
}

function buildFallbackSummary(count: number) {
  return `Premiere liste generee localement a partir du profil, des domaines valides et des localisations cibles. ${count} entreprise(s) sont proposees pour guider la collecte sur sites carrieres et ATS.`;
}

function buildFallbackSuggestions(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
  companyWatchlist: CompanyWatchlistFile,
) {
  const signals = buildUserSignals(personalProfile, searchTargets);
  const tracked = new Set(companyWatchlist.items.map((item) => item.normalizedName));

  const ranked = companyCatalog
    .filter((entry) => !tracked.has(normalizeCompanyName(entry.companyName)))
    .map((entry) => {
      const { score, matchedSignals, reasons } = scoreEntry(entry, signals);

      return {
        entry,
        score,
        matchedSignals,
        reasons,
      };
    })
    .filter((item) => item.score >= 18)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  const selected = ranked.length > 0 ? ranked : companyCatalog.slice(0, 5).map((entry) => ({
    entry,
    score: 50,
    matchedSignals: uniqueList(searchTargets.preferredDomains.map((domain) => domain.label)).slice(0, 3),
    reasons: ["suggestion generaliste en attendant plus de signaux profil"],
  }));

  return companyTargetSuggestionSchema.parse({
    summary: buildFallbackSummary(selected.length),
    suggestions: selected.map(({ entry, score, matchedSignals, reasons }) => ({
      companyName: entry.companyName,
      websiteUrl: entry.websiteUrl,
      careerPageUrl: entry.careerPageUrl,
      notes: entry.notes,
      rationale: reasons.join("; "),
      priority: Math.max(Math.min(score, 100), 40),
      tags: entry.tags.slice(0, 4),
      matchedSignals,
    })),
  });
}

function buildCompanyTargetPrompt(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
  companyWatchlist: CompanyWatchlistFile,
) {
  return [
    "Tu aides a cibler des entreprises pertinentes pour une recherche de stage ou d emploi.",
    "A partir du profil, des domaines valides et des preferences de recherche, propose une liste priorisee d entreprises a investiguer.",
    "Contraintes:",
    "- priorise les entreprises dont les vraies offres risquent d etre publiees sur leurs propres sites plutot que seulement sur LinkedIn",
    "- couvre startups, scale-ups, groupes et organismes publics si le profil s y prete",
    "- explique pourquoi chaque entreprise est pertinente",
    "- n inclus pas les entreprises deja presentes dans la watchlist",
    "- ne retourne pas plus de 8 suggestions",
    "",
    "Profil utilisateur:",
    JSON.stringify(personalProfile, null, 2),
    "",
    "Recherche actuelle:",
    JSON.stringify(searchTargets, null, 2),
    "",
    "Watchlist existante:",
    JSON.stringify(companyWatchlist, null, 2),
  ].join("\n");
}

async function generateWithGemini(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
  companyWatchlist: CompanyWatchlistFile,
) {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Gemini API key is missing");
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const prompt = buildCompanyTargetPrompt(personalProfile, searchTargets, companyWatchlist);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    companyName: { type: "string" },
                    websiteUrl: { type: ["string", "null"] },
                    careerPageUrl: { type: ["string", "null"] },
                    notes: { type: ["string", "null"] },
                    rationale: { type: "string" },
                    priority: { type: "number" },
                    tags: {
                      type: "array",
                      items: { type: "string" },
                    },
                    matchedSignals: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["companyName", "rationale", "priority", "tags", "matchedSignals"],
                },
              },
            },
            required: ["summary", "suggestions"],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned no company targets payload");
  }

  const parsed = companyTargetSuggestionSchema.parse(JSON.parse(text));
  const tracked = new Set(companyWatchlist.items.map((item) => item.normalizedName));
  const catalogIndex = new Map(
    companyCatalog.map((entry) => [normalizeCompanyName(entry.companyName), entry]),
  );

  return companyTargetSuggestionSchema.parse({
    summary: parsed.summary,
    suggestions: parsed.suggestions
      .filter((suggestion) => !tracked.has(normalizeCompanyName(suggestion.companyName)))
      .map((suggestion) => {
        const catalogEntry = catalogIndex.get(normalizeCompanyName(suggestion.companyName));

        return {
          ...suggestion,
          websiteUrl: suggestion.websiteUrl ?? catalogEntry?.websiteUrl ?? null,
          careerPageUrl: suggestion.careerPageUrl ?? catalogEntry?.careerPageUrl ?? null,
          notes: suggestion.notes ?? catalogEntry?.notes ?? null,
        };
      })
      .slice(0, 8),
  });
}

export async function generateCompanyTargetSuggestions(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
  companyWatchlist: CompanyWatchlistFile,
): Promise<CompanyTargetSuggestionResult> {
  try {
    const geminiResult = await generateWithGemini(
      personalProfile,
      searchTargets,
      companyWatchlist,
    );

    if (geminiResult.suggestions.length > 0) {
      return {
        ...geminiResult,
        provider: "gemini",
      };
    }
  } catch {
    // Fall back to deterministic matching when Gemini is unavailable or returns invalid output.
  }

  return {
    ...buildFallbackSuggestions(personalProfile, searchTargets, companyWatchlist),
    provider: "fallback",
  };
}
