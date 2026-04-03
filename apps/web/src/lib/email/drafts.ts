import {
  DraftStatus,
  EmailDeliveryOperation,
  EmailDeliveryLogStatus,
} from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { createEmailDeliveryLog } from "@/lib/email/delivery-logs";
import {
  ensureGmailConnectionAccess,
  GmailMailboxError,
} from "@/lib/email/gmail-connection";
import { buildOfferGeminiContext } from "@/lib/email/gemini-offer-context";
import {
  GOOGLE_OAUTH_SCOPES,
  createGmailDraft,
  sendGmailMessage,
} from "@/lib/email/google";
import {
  buildOfferEmailPersonalizationPrompt,
  type OfferEmailPersonalizationPrompt,
} from "@/lib/email/personalization-prompt";
import { logServiceError } from "@/lib/observability/error-logging";
import { buildSignalsFromOfferRecord, recordSearchBehaviorEvent } from "@/server/application/personalization/search-behavior-service";
import { getRequiredActiveWorkspaceIdForUser } from "@/server/application/workspace/workspace-service";

const generatedDraftSchema = z.object({
  subject: z.string().trim().min(6).max(160),
  body: z.string().trim().min(80).max(4000),
});

const updateDraftSchema = z.object({
  recipientEmail: z
    .union([z.string().trim().email(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  subject: z.string().trim().min(6).max(160),
  body: z.string().trim().min(80).max(4000),
});

const draftDeliveryInputSchema = z
  .object({
    recipientEmail: z
      .union([z.string().trim().email(), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (value ? value : null)),
  })
  .default({
    recipientEmail: null,
  });

export type GeneratedEmailDraft = z.infer<typeof generatedDraftSchema> & {
  draftId: string;
  provider: "gemini" | "fallback";
  generatedBy: string;
  personalizationSummary: string;
};

export type EmailDraftListItem = {
  id: string;
  status: DraftStatus;
  recipientEmail: string | null;
  subject: string | null;
  body: string;
  personalizationSummary: string | null;
  generatedBy: string | null;
  deliveryProvider: string | null;
  gmailDraftId: string | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
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

export class EmailDraftDeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EmailDraftDeliveryError";
  }
}

type DraftSelectPayload = {
  id: string;
  status: DraftStatus;
  recipientEmail: string | null;
  subject: string | null;
  body: string;
  personalizationSummary: string | null;
  generatedBy: string | null;
  deliveryProvider: string | null;
  gmailDraftId: string | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  updatedAt: Date;
  jobOffer: {
    id: string;
    title: string;
    companyName: string;
    sourceUrl: string;
  } | null;
};

function toListItem(draft: DraftSelectPayload): EmailDraftListItem {
  return {
    id: draft.id,
    status: draft.status,
    recipientEmail: draft.recipientEmail,
    subject: draft.subject,
    body: draft.body,
    personalizationSummary: draft.personalizationSummary,
    generatedBy: draft.generatedBy,
    deliveryProvider: draft.deliveryProvider,
    gmailDraftId: draft.gmailDraftId,
    gmailMessageId: draft.gmailMessageId,
    gmailThreadId: draft.gmailThreadId,
    updatedAt: draft.updatedAt.toISOString(),
    jobOffer: draft.jobOffer,
  };
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

async function getSuggestedRecipientEmail(userId: string, jobOfferId: string | null) {
  if (!jobOfferId) {
    return null;
  }

  const suggestion = await db.offerMailboxSignal.findFirst({
    where: {
      userId,
      jobOfferId,
    },
    orderBy: {
      detectedAt: "desc",
    },
    select: {
      mailboxMessage: {
        select: {
          fromEmail: true,
          toEmails: true,
        },
      },
    },
  });

  if (suggestion?.mailboxMessage?.fromEmail) {
    return suggestion.mailboxMessage.fromEmail;
  }

  if (Array.isArray(suggestion?.mailboxMessage?.toEmails)) {
    const candidate = suggestion.mailboxMessage.toEmails.find(
      (value): value is string => typeof value === "string" && value.includes("@"),
    );

    return candidate ?? null;
  }

  return null;
}

async function getDraftForListItem(userId: string, draftId: string) {
  const draft = await db.emailDraft.findFirst({
    where: {
      id: draftId,
      userId,
    },
    select: {
      id: true,
      status: true,
      recipientEmail: true,
      subject: true,
      body: true,
      personalizationSummary: true,
      generatedBy: true,
      deliveryProvider: true,
      gmailDraftId: true,
      gmailMessageId: true,
      gmailThreadId: true,
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

  if (!draft) {
    throw new EmailDraftDeliveryError("Draft not found", 404);
  }

  return toListItem(draft);
}

type OwnedDraft = {
  id: string;
  jobOfferId: string | null;
  status: DraftStatus;
  recipientEmail: string | null;
  subject: string | null;
  body: string;
  gmailThreadId: string | null;
};

async function getOwnedDraft(userId: string, draftId: string): Promise<OwnedDraft> {
  const draft = await db.emailDraft.findFirst({
    where: {
      id: draftId,
      userId,
    },
    select: {
      id: true,
      jobOfferId: true,
      status: true,
      recipientEmail: true,
      subject: true,
      body: true,
      gmailThreadId: true,
    },
  });

  if (!draft) {
    throw new EmailDraftDeliveryError("Draft not found", 404);
  }

  return draft;
}

async function resolveDraftDeliveryContext(
  userId: string,
  draft: OwnedDraft,
  requestedRecipientEmail: string | null | undefined,
) {
  const recipientEmail =
    requestedRecipientEmail?.trim() ||
    draft.recipientEmail ||
    (await getSuggestedRecipientEmail(userId, draft.jobOfferId));

  if (!recipientEmail) {
    throw new EmailDraftDeliveryError(
      "Recipient email is required before creating or sending a Gmail draft",
      400,
    );
  }

  if (!draft.subject) {
    throw new EmailDraftDeliveryError("Draft subject is required", 400);
  }

  let gmailThreadId = draft.gmailThreadId;

  if (!gmailThreadId && draft.jobOfferId) {
    const signal = await db.offerMailboxSignal.findFirst({
      where: {
        userId,
        jobOfferId: draft.jobOfferId,
      },
      orderBy: {
        detectedAt: "desc",
      },
      select: {
        providerThreadId: true,
      },
    });

    gmailThreadId = signal?.providerThreadId ?? null;
  }

  return {
    recipientEmail,
    subject: draft.subject,
    body: draft.body,
    gmailThreadId,
  };
}

export async function generateOfferEmailDraft(
  userId: string,
  jobOfferId: string,
): Promise<GeneratedEmailDraft> {
  const workspaceId = await getRequiredActiveWorkspaceIdForUser(userId);
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
  const recipientEmail = await getSuggestedRecipientEmail(userId, jobOfferId);

  const savedDraft = await db.emailDraft.create({
    data: {
      userId,
      workspaceId,
      jobOfferId,
      status: DraftStatus.DRAFT,
      recipientEmail,
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

  await recordSearchBehaviorEvent(
    {
      userId,
      workspaceId,
    },
    {
      type: "DRAFT_GENERATED",
      jobOfferId,
      emailDraftId: savedDraft.id,
      companyName: context.offer.companyName,
      sourceUrl: context.offer.sourceUrl,
      signals: buildSignalsFromOfferRecord({
        title: context.offer.title,
        companyName: context.offer.companyName,
        locationLabel: context.offer.locationLabel,
        employmentType: context.offer.contractType,
        workMode: context.offer.workMode,
      }),
      metadata: {
        provider,
        generatedBy,
      },
    },
  );

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
      recipientEmail: true,
      subject: true,
      body: true,
      personalizationSummary: true,
      generatedBy: true,
      deliveryProvider: true,
      gmailDraftId: true,
      gmailMessageId: true,
      gmailThreadId: true,
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

  return drafts.map((draft) => toListItem(draft));
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
      recipientEmail: parsed.data.recipientEmail ?? undefined,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: DraftStatus.READY_FOR_REVIEW,
    },
    select: {
      id: true,
      status: true,
      recipientEmail: true,
      subject: true,
      body: true,
      personalizationSummary: true,
      generatedBy: true,
      deliveryProvider: true,
      gmailDraftId: true,
      gmailMessageId: true,
      gmailThreadId: true,
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

  return toListItem(draft);
}

export async function createGmailDraftFromEmailDraft(
  userId: string,
  draftId: string,
  input: unknown,
) {
  const parsed = draftDeliveryInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new EmailDraftDeliveryError("Invalid Gmail draft payload", 400);
  }

  const draft = await getOwnedDraft(userId, draftId);
  const deliveryContext = await resolveDraftDeliveryContext(
    userId,
    draft,
    parsed.data.recipientEmail,
  );

  try {
    const { accessToken } = await ensureGmailConnectionAccess({
      userId,
      requiredScopes: [...GOOGLE_OAUTH_SCOPES.compose],
    });
    const gmailDraft = await createGmailDraft({
      accessToken,
      to: deliveryContext.recipientEmail,
      subject: deliveryContext.subject,
      body: deliveryContext.body,
      threadId: deliveryContext.gmailThreadId,
    });

    await db.emailDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        recipientEmail: deliveryContext.recipientEmail,
        status: DraftStatus.APPROVED,
        approvedAt: new Date(),
        deliveryProvider: "gmail",
        gmailDraftId: gmailDraft.id ?? null,
        gmailMessageId: gmailDraft.message?.id ?? null,
        gmailThreadId: gmailDraft.message?.threadId ?? deliveryContext.gmailThreadId,
      },
    });

    await createEmailDeliveryLog({
      userId,
      emailDraftId: draft.id,
      provider: "gmail",
      operation: EmailDeliveryOperation.GMAIL_DRAFT,
      status: EmailDeliveryLogStatus.SUCCESS,
      recipientEmail: deliveryContext.recipientEmail,
      subject: deliveryContext.subject,
      bodyPreview: deliveryContext.body,
      providerDraftId: gmailDraft.id ?? null,
      providerMessageId: gmailDraft.message?.id ?? null,
      providerThreadId:
        gmailDraft.message?.threadId ?? deliveryContext.gmailThreadId,
    });
  } catch (error) {
    await createEmailDeliveryLog({
      userId,
      emailDraftId: draft.id,
      provider: "gmail",
      operation: EmailDeliveryOperation.GMAIL_DRAFT,
      status: EmailDeliveryLogStatus.FAILED,
      recipientEmail: deliveryContext.recipientEmail,
      subject: deliveryContext.subject,
      bodyPreview: deliveryContext.body,
      errorMessage:
        error instanceof Error ? error.message : "Gmail draft creation failed",
    });

    if (error instanceof GmailMailboxError) {
      throw new EmailDraftDeliveryError(error.message, error.status);
    }

    throw error;
  }

  return getDraftForListItem(userId, draft.id);
}

export async function sendEmailDraftWithGmail(
  userId: string,
  draftId: string,
  input: unknown,
) {
  const parsed = draftDeliveryInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new EmailDraftDeliveryError("Invalid Gmail send payload", 400);
  }

  const draft = await getOwnedDraft(userId, draftId);
  const deliveryContext = await resolveDraftDeliveryContext(
    userId,
    draft,
    parsed.data.recipientEmail,
  );

  try {
    const { accessToken } = await ensureGmailConnectionAccess({
      userId,
      requiredScopes: [...GOOGLE_OAUTH_SCOPES.compose],
    });
    const sent = await sendGmailMessage({
      accessToken,
      to: deliveryContext.recipientEmail,
      subject: deliveryContext.subject,
      body: deliveryContext.body,
      threadId: deliveryContext.gmailThreadId,
    });

    await db.emailDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        recipientEmail: deliveryContext.recipientEmail,
        status: DraftStatus.SENT,
        approvedAt: draft.status === DraftStatus.APPROVED ? undefined : new Date(),
        sentAt: new Date(),
        deliveryProvider: "gmail",
        gmailMessageId: sent.id ?? null,
        gmailThreadId: sent.threadId ?? deliveryContext.gmailThreadId,
      },
    });

    await createEmailDeliveryLog({
      userId,
      emailDraftId: draft.id,
      provider: "gmail",
      operation: EmailDeliveryOperation.GMAIL_SEND,
      status: EmailDeliveryLogStatus.SUCCESS,
      recipientEmail: deliveryContext.recipientEmail,
      subject: deliveryContext.subject,
      bodyPreview: deliveryContext.body,
      providerMessageId: sent.id ?? null,
      providerThreadId: sent.threadId ?? deliveryContext.gmailThreadId,
      metadata: {
        labelIds: sent.labelIds ?? [],
      },
    });

    if (draft.jobOfferId) {
      const offer = await db.jobOffer.findFirst({
        where: {
          id: draft.jobOfferId,
          userId,
        },
        select: {
          id: true,
          workspaceId: true,
          title: true,
          companyName: true,
          locationLabel: true,
          employmentType: true,
          workMode: true,
          sourceUrl: true,
          rawPayload: true,
        },
      });

      if (offer) {
        await recordSearchBehaviorEvent(
          {
            userId,
            workspaceId: offer.workspaceId ?? undefined,
          },
          {
            type: "EMAIL_SENT",
            jobOfferId: offer.id,
            emailDraftId: draft.id,
            companyName: offer.companyName,
            sourceUrl: offer.sourceUrl,
            signals: buildSignalsFromOfferRecord(offer),
            metadata: {
              recipientEmail: deliveryContext.recipientEmail,
              providerThreadId: sent.threadId ?? deliveryContext.gmailThreadId,
            },
          },
        );
      }
    }
  } catch (error) {
    await createEmailDeliveryLog({
      userId,
      emailDraftId: draft.id,
      provider: "gmail",
      operation: EmailDeliveryOperation.GMAIL_SEND,
      status: EmailDeliveryLogStatus.FAILED,
      recipientEmail: deliveryContext.recipientEmail,
      subject: deliveryContext.subject,
      bodyPreview: deliveryContext.body,
      errorMessage: error instanceof Error ? error.message : "Gmail send failed",
    });

    if (error instanceof GmailMailboxError) {
      throw new EmailDraftDeliveryError(error.message, error.status);
    }

    throw error;
  }

  return getDraftForListItem(userId, draft.id);
}
