import { DraftStatus } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { buildOfferGeminiContext } from "@/lib/email/gemini-offer-context";
import {
  buildOfferEmailPersonalizationPrompt,
  type OfferEmailPersonalizationPrompt,
} from "@/lib/email/personalization-prompt";
import { logServiceError } from "@/lib/observability/error-logging";

const generatedDraftSchema = z.object({
  subject: z.string().trim().min(6).max(160),
  body: z.string().trim().min(80).max(4000),
});

export type GeneratedEmailDraft = z.infer<typeof generatedDraftSchema> & {
  draftId: string;
  provider: "gemini" | "fallback";
  generatedBy: string;
  personalizationSummary: string;
};

const updateDraftSchema = z.object({
  subject: z.string().trim().min(6).max(160),
  body: z.string().trim().min(80).max(4000),
});

export type EmailDraftListItem = {
  id: string;
  status: DraftStatus;
  subject: string | null;
  body: string;
  personalizationSummary: string | null;
  generatedBy: string | null;
  updatedAt: string;
  jobOffer: {
    id: string;
    title: string;
    companyName: string;
    sourceUrl: string;
  } | null;
};

export class OfferEmailDraftError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OfferEmailDraftError";
  }
}

export class EmailDraftUpdateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EmailDraftUpdateError";
  }
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    null
  );
}

function buildPersonalizationSummary(
  prompt: OfferEmailPersonalizationPrompt,
  matchExplanation: string | null,
) {
  const keyLines = [
    matchExplanation,
    prompt.userPrompt.split("\n").find((line) => line.startsWith("Tache demandee")) ?? null,
  ].filter(Boolean);

  return keyLines.join(" | ").slice(0, 500);
}

function buildFallbackDraft(prompt: OfferEmailPersonalizationPrompt) {
  const body = [
    "Bonjour,",
    "",
    "Je me permets de vous contacter au sujet de l offre mentionnee ci-dessous.",
    "Mon profil semble bien aligne avec plusieurs attentes du poste, notamment sur les competences techniques et le contexte cible de recherche.",
    "Je serais ravi d echanger pour vous presenter plus concretement ma motivation et ce que je peux apporter a l equipe.",
    "",
    "Je vous remercie pour votre attention.",
  ].join("\n");

  return generatedDraftSchema.parse({
    subject: "Candidature pour l offre mentionnee",
    body: `${body}\n\nContexte interne utilise:\n${prompt.userPrompt.slice(0, 900)}`,
  });
}

async function generateDraftWithGemini(prompt: OfferEmailPersonalizationPrompt, apiKey: string) {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: prompt.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt.userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              subject: {
                type: "string",
                description: "Email subject line in French.",
              },
              body: {
                type: "string",
                description: "Email body in French, plain text only.",
              },
            },
            required: ["subject", "body"],
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
    throw new Error("Gemini returned no draft payload");
  }

  return {
    model,
    draft: generatedDraftSchema.parse(JSON.parse(text)),
  };
}

export async function generateOfferEmailDraft(
  userId: string,
  jobOfferId: string,
): Promise<GeneratedEmailDraft> {
  const context = await buildOfferGeminiContext(userId, jobOfferId);
  const prompt = buildOfferEmailPersonalizationPrompt(context);
  const apiKey = getGeminiApiKey();

  let generatedBy = "fallback-template";
  let provider: GeneratedEmailDraft["provider"] = "fallback";
  let draft = buildFallbackDraft(prompt);

  if (apiKey) {
    try {
      const geminiResult = await generateDraftWithGemini(prompt, apiKey);
      generatedBy = geminiResult.model;
      provider = "gemini";
      draft = geminiResult.draft;
    } catch (error) {
      logServiceError({
        level: "warn",
        scope: "email/drafts",
        message: "Gemini draft generation failed, fallback template used instead",
        error,
        metadata: {
          userId,
          jobOfferId,
        },
      });
    }
  }

  const personalizationSummary = buildPersonalizationSummary(
    prompt,
    context.signals.matchExplanation,
  );

  const savedDraft = await db.emailDraft.create({
    data: {
      userId,
      jobOfferId,
      status: DraftStatus.DRAFT,
      subject: draft.subject,
      body: draft.body,
      personalizationSummary,
      generatedBy,
      contextSnapshot: {
        context,
        prompt,
        provider,
      },
    },
    select: {
      id: true,
    },
  });

  return {
    draftId: savedDraft.id,
    subject: draft.subject,
    body: draft.body,
    provider,
    generatedBy,
    personalizationSummary,
  };
}

export async function listEmailDraftsForUser(userId: string): Promise<EmailDraftListItem[]> {
  const drafts = await db.emailDraft.findMany({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      status: true,
      subject: true,
      body: true,
      personalizationSummary: true,
      generatedBy: true,
      updatedAt: true,
      jobOffer: {
        select: {
          id: true,
          title: true,
          companyName: true,
          sourceUrl: true,
        },
      },
    },
  });

  return drafts.map((draft) => ({
    id: draft.id,
    status: draft.status,
    subject: draft.subject,
    body: draft.body,
    personalizationSummary: draft.personalizationSummary,
    generatedBy: draft.generatedBy,
    updatedAt: draft.updatedAt.toISOString(),
    jobOffer: draft.jobOffer,
  }));
}

export async function updateEmailDraft(
  userId: string,
  draftId: string,
  input: unknown,
): Promise<EmailDraftListItem> {
  const parsed = updateDraftSchema.safeParse(input);

  if (!parsed.success) {
    throw new EmailDraftUpdateError("Invalid draft update payload", 400);
  }

  const existingDraft = await db.emailDraft.findFirst({
    where: {
      id: draftId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!existingDraft) {
    throw new EmailDraftUpdateError("Draft not found", 404);
  }

  const draft = await db.emailDraft.update({
    where: {
      id: draftId,
    },
    data: {
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: DraftStatus.READY_FOR_REVIEW,
    },
    select: {
      id: true,
      status: true,
      subject: true,
      body: true,
      personalizationSummary: true,
      generatedBy: true,
      updatedAt: true,
      jobOffer: {
        select: {
          id: true,
          title: true,
          companyName: true,
          sourceUrl: true,
        },
      },
    },
  });

  return {
    id: draft.id,
    status: draft.status,
    subject: draft.subject,
    body: draft.body,
    personalizationSummary: draft.personalizationSummary,
    generatedBy: draft.generatedBy,
    updatedAt: draft.updatedAt.toISOString(),
    jobOffer: draft.jobOffer,
  };
}
