import { z } from "zod";

import { generateGeminiJson, getGeminiApiKey } from "@/lib/ai/gemini";
import { db } from "@/lib/db";
import { logServiceError } from "@/lib/observability/error-logging";
import { inferSignalsFromText, parsePdfText } from "@/lib/profile/enrichment";
import type { ResumeProfileSuggestions } from "@/lib/profile/resume-suggestions";
import { getRequiredActiveWorkspaceIdForUser } from "@/server/application/workspace/workspace-service";

// Vercel rejects request bodies above 4.5 MB.
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;
const MAX_STORED_RESUME_CHARS = 30000;
const MIN_READABLE_RESUME_CHARS = 80;
const GEMINI_RESUME_INPUT_CHARS = 12000;

const LANGUAGE_PATTERNS: Array<[string, RegExp]> = [
  ["Français", /\bfran[cç]ais\b|\bfrench\b/i],
  ["Anglais", /\banglais\b|\benglish\b/i],
  ["Espagnol", /\bespagnol\b|\bspanish\b/i],
  ["Allemand", /\ballemand\b|\bgerman\b/i],
  ["Italien", /\bitalien\b|\bitalian\b/i],
  ["Portugais", /\bportugais\b|\bportuguese\b/i],
  ["Arabe", /\barabe\b|\barabic\b/i],
  ["Chinois", /\bchinois\b|\bmandarin\b|\bchinese\b/i],
  ["Japonais", /\bjaponais\b|\bjapanese\b/i],
];

const resumeSuggestionsSchema = z.object({
  headline: z.string().trim().max(160).nullable().catch(null),
  summary: z.string().trim().max(2000).nullable().catch(null),
  school: z.string().trim().max(160).nullable().catch(null),
  degree: z.string().trim().max(160).nullable().catch(null),
  graduationYear: z.number().int().min(2000).max(2100).nullable().catch(null),
  city: z.string().trim().max(120).nullable().catch(null),
  skills: z.array(z.string().trim().min(1).max(80)).max(40).catch([]),
  targetRoles: z.array(z.string().trim().min(1).max(120)).max(10).catch([]),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).catch([]),
  hasDrivingLicense: z.boolean().nullable().catch(null),
});

export class ResumeImportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ResumeImportError";
  }
}

function isPdf(bytes: Buffer) {
  return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

function compactResumeText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_STORED_RESUME_CHARS);
}

export function extractResumeSuggestionsWithoutAi(text: string): ResumeProfileSuggestions {
  const lowered = text.toLowerCase();

  return {
    headline: null,
    summary: null,
    school: null,
    degree: null,
    graduationYear: null,
    city: null,
    skills: inferSignalsFromText(lowered)
      .filter((signal) => signal.category === "technology")
      .map((signal) => signal.label),
    targetRoles: [],
    languages: LANGUAGE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(
      ([label]) => label,
    ),
    hasDrivingLicense: /\bpermis\s+(?:b|de\s+conduire)\b|\bdriving\s+licen[cs]e\b/i.test(text)
      ? true
      : null,
  };
}

async function extractResumeSuggestionsWithGemini(text: string, apiKey: string) {
  const { data } = await generateGeminiJson({
    apiKey,
    systemPrompt: [
      "Tu extrais des informations d un CV pour pre-remplir un profil de recherche de stage, d alternance ou d emploi.",
      "Tu ne gardes que ce qui est explicitement ecrit dans le CV: n invente rien, ne deduis pas de competence absente.",
      "Reponds en francais. Laisse a null ou en liste vide ce qui n apparait pas.",
      "headline: une phrase courte qui resume le profil (ex: Etudiant ingenieur en informatique, recherche un stage backend).",
      "summary: deux a trois phrases factuelles sur le parcours.",
      "targetRoles: les postes vises s ils sont mentionnes, sinon ceux qui decoulent directement des experiences.",
      "hasDrivingLicense: true seulement si le permis est mentionne, null sinon.",
    ].join(" "),
    prompt: `CV:\n${text.slice(0, GEMINI_RESUME_INPUT_CHARS)}`,
    responseJsonSchema: {
      type: "object",
      properties: {
        headline: { type: ["string", "null"] },
        summary: { type: ["string", "null"] },
        school: { type: ["string", "null"] },
        degree: { type: ["string", "null"] },
        graduationYear: { type: ["integer", "null"] },
        city: { type: ["string", "null"] },
        skills: { type: "array", items: { type: "string" } },
        targetRoles: { type: "array", items: { type: "string" } },
        languages: { type: "array", items: { type: "string" } },
        hasDrivingLicense: { type: ["boolean", "null"] },
      },
      required: ["skills", "targetRoles", "languages"],
    },
  });

  return resumeSuggestionsSchema.parse(data);
}

export async function importResumeForUser(userId: string, file: File) {
  if (file.size === 0) {
    throw new ResumeImportError("Le fichier est vide.", 400);
  }

  if (file.size > MAX_RESUME_BYTES) {
    throw new ResumeImportError("Le CV dépasse 4 Mo.", 413);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (!isPdf(bytes)) {
    throw new ResumeImportError("Le CV doit être un fichier PDF.", 415);
  }

  let rawText: string;

  try {
    rawText = await parsePdfText(bytes);
  } catch (error) {
    logServiceError({
      level: "warn",
      scope: "profile/resume-import",
      message: "PDF text extraction failed",
      error,
    });
    throw new ResumeImportError("Impossible de lire ce PDF.", 422);
  }

  const text = compactResumeText(rawText);

  if (text.length < MIN_READABLE_RESUME_CHARS) {
    throw new ResumeImportError(
      "Ce PDF ne contient presque pas de texte (CV scanné ?). Exporte-le depuis ton traitement de texte.",
      422,
    );
  }

  const fileName = file.name.slice(0, 160) || "cv.pdf";
  const now = new Date();
  const updated = await db.userProfile.updateMany({
    where: { userId },
    data: { resumeFileName: fileName, resumeText: text, resumeUploadedAt: now },
  });

  if (updated.count === 0) {
    await db.userProfile.create({
      data: {
        userId,
        workspaceId: await getRequiredActiveWorkspaceIdForUser(userId),
        resumeFileName: fileName,
        resumeText: text,
        resumeUploadedAt: now,
      },
    });
  }

  let suggestions = extractResumeSuggestionsWithoutAi(text);
  let provider: "gemini" | "fallback" = "fallback";
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      suggestions = await extractResumeSuggestionsWithGemini(text, apiKey);
      provider = "gemini";
    } catch (error) {
      logServiceError({
        level: "warn",
        scope: "profile/resume-import",
        message: "Gemini resume extraction failed, keyword extraction used instead",
        error,
        metadata: { userId },
      });
    }
  }

  return {
    fileName,
    uploadedAt: now.toISOString(),
    provider,
    suggestions,
  };
}

export async function deleteResumeForUser(userId: string) {
  await db.userProfile.updateMany({
    where: { userId },
    data: { resumeFileName: null, resumeText: null, resumeUploadedAt: null },
  });
}
