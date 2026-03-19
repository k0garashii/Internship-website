import { z } from "zod";

import type { PersonalProfileFile } from "@/lib/config/personal-profile";
import type { SearchTargetsFile } from "@/lib/config/search-targets";
import { normalizeListItem } from "@/lib/profile/schema";

const domainBootstrapSchema = z.object({
  summary: z.string().trim().min(1).max(400),
  domains: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(160),
        rationale: z.string().trim().min(4).max(240),
      }),
    )
    .min(1)
    .max(8),
  targetRoles: z.array(z.string().trim().min(2).max(160)).min(1).max(8),
  locations: z.array(z.string().trim().min(2).max(160)).max(8),
  keywords: z.array(z.string().trim().min(2).max(80)).min(1).max(16),
});

export type DomainBootstrapResult = z.output<typeof domainBootstrapSchema> & {
  provider: "gemini" | "fallback";
};

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => normalizeListItem(item)).filter(Boolean)));
}

function inferDomainsFromSkills(skills: string[]) {
  const lowered = skills.map((skill) => skill.toLowerCase());
  const suggestions = new Map<string, string>();

  const match = (tokens: string[]) => tokens.some((token) => lowered.some((skill) => skill.includes(token)));

  if (match(["typescript", "node", "api", "backend", "prisma"])) {
    suggestions.set(
      "Developer Tools",
      "Le profil montre un axe backend et automatisation adapte aux outils pour equipes techniques.",
    );
    suggestions.set(
      "SaaS B2B",
      "Le stack backend TypeScript et l orientation produit cadrent bien avec des environnements SaaS B2B.",
    );
  }

  if (match(["data", "python", "ml", "machine learning", "ai"])) {
    suggestions.set(
      "Data & AI",
      "Les competences detectees pointent vers des equipes data platform ou IA appliquee.",
    );
  }

  if (match(["cloud", "infra", "kubernetes", "platform", "devops"])) {
    suggestions.set(
      "Cloud & Platform",
      "Le profil contient des signaux clairs pour des sujets plateforme et infrastructure logicielle.",
    );
  }

  if (match(["finance", "payment", "fintech"])) {
    suggestions.set(
      "Fintech",
      "Les mots cles du profil rendent le secteur fintech pertinent pour la premiere base ciblee.",
    );
  }

  if (suggestions.size === 0) {
    suggestions.set(
      "Software Products",
      "Le profil cible des equipes produit software generalistes avec un scope d execution technique.",
    );
  }

  return Array.from(suggestions.entries()).map(([label, rationale]) => ({
    label,
    rationale,
  }));
}

function buildFallbackBootstrap(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  const skillKeywords = uniqueList(personalProfile.profile.skills);
  const explicitKeywords = uniqueList(searchTargets.keywords);
  const targetTitles = uniqueList(searchTargets.targets.map((target) => target.title));
  const locations = uniqueList(searchTargets.preferredLocations.map((location) => location.label));
  const domainSeeds = searchTargets.preferredDomains.map((domain) => ({
    label: normalizeListItem(domain.label),
    rationale:
      domain.rationale ??
      "Preference deja explicitee par l utilisateur dans ses parametres de recherche.",
  }));

  const inferredDomains = inferDomainsFromSkills([
    ...skillKeywords,
    ...explicitKeywords,
    personalProfile.profile.headline ?? "",
    personalProfile.profile.summary ?? "",
  ]);

  const domains = Array.from(
    new Map(
      [...domainSeeds, ...inferredDomains]
        .filter((domain) => domain.label)
        .map((domain) => [domain.label.toLowerCase(), domain]),
    ).values(),
  ).slice(0, 6);

  const keywords = uniqueList([
    ...explicitKeywords,
    ...skillKeywords,
    ...(personalProfile.profile.headline
      ? personalProfile.profile.headline.split(/[,\s]+/)
      : []),
  ]).slice(0, 12);

  const targetRoles =
    targetTitles.length > 0
      ? targetTitles
      : uniqueList([
          personalProfile.profile.headline ?? "",
          personalProfile.profile.experienceLevel
            ? `${personalProfile.profile.experienceLevel} software engineer`
            : "",
        ]).slice(0, 4);

  return domainBootstrapSchema.parse({
    summary:
      "Base initiale generee a partir du profil en local, pour amorcer la recherche avant une iteration Gemini.",
    domains,
    targetRoles,
    locations,
    keywords,
  });
}

export function buildGeminiDomainBootstrapPrompt(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
) {
  return [
    "Tu aides a initialiser une recherche de stage ou d emploi.",
    "A partir du profil et des preferences ci-dessous, propose une premiere base editable de domaines, cibles, localisations et mots cles.",
    "Contraintes:",
    "- reste concret et operationnel pour une recherche d offres",
    "- evite les domaines trop generiques ou hors sujet",
    "- priorise les secteurs et contextes compatibles avec le profil",
    "- n invente pas de contraintes non presentes",
    "- les suggestions doivent rester modifiables par l utilisateur",
    "",
    "Profil utilisateur:",
    JSON.stringify(personalProfile, null, 2),
    "",
    "Recherche actuelle:",
    JSON.stringify(searchTargets, null, 2),
    "",
    "Retourne une base initiale coherente avec des domaines prioritaires, des roles cibles, des localisations et des mots cles de recherche.",
  ].join("\n");
}

async function generateWithGemini(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
  apiKey: string,
) {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const prompt = buildGeminiDomainBootstrapPrompt(personalProfile, searchTargets);
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
              summary: {
                type: "string",
                description: "Short explanation of the generated base.",
              },
              domains: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Domain name." },
                    rationale: {
                      type: "string",
                      description: "Why this domain fits the profile.",
                    },
                  },
                  required: ["label", "rationale"],
                },
              },
              targetRoles: {
                type: "array",
                items: { type: "string" },
              },
              locations: {
                type: "array",
                items: { type: "string" },
              },
              keywords: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["summary", "domains", "targetRoles", "locations", "keywords"],
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
    throw new Error("Gemini returned no structured payload");
  }

  return domainBootstrapSchema.parse(JSON.parse(text));
}

export async function generateDomainBootstrap(
  personalProfile: PersonalProfileFile,
  searchTargets: SearchTargetsFile,
): Promise<DomainBootstrapResult> {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim();

  if (apiKey) {
    try {
      const geminiResult = await generateWithGemini(personalProfile, searchTargets, apiKey);
      return {
        ...geminiResult,
        provider: "gemini",
      };
    } catch {
      // Fall through to a deterministic bootstrap if the external call fails.
    }
  }

  return {
    ...buildFallbackBootstrap(personalProfile, searchTargets),
    provider: "fallback",
  };
}
