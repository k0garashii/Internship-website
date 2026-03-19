import { createHash, randomBytes } from "node:crypto";

import {
  EmailIngestionConnectionStatus,
  EmailIngestionSourceType,
  InboundEmailSignal,
  InboundEmailStatus,
} from "@prisma/client";
import { z } from "zod";

import { type AuthenticatedViewer, assertAuthenticatedViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db";

const FORWARDING_LABEL = "Forwarding dedie";
const FORWARDING_WEBHOOK_PATH = "/api/email/forwarding/intake";
const PREVIEW_LENGTH = 2000;
const SNIPPET_LENGTH = 280;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/i;

const optionalStringSchema = z
  .union([z.string().trim(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

const nestedForwardedEmailSchema = z.object({
  envelope: z.object({
    to: z.string().trim().min(3).max(320),
    from: z.string().trim().min(3).max(320),
    messageId: optionalStringSchema,
    receivedAt: optionalStringSchema,
  }),
  message: z.object({
    subject: optionalStringSchema,
    text: optionalStringSchema,
    html: optionalStringSchema,
    snippet: optionalStringSchema,
  }),
  metadata: z
    .object({
      provider: optionalStringSchema,
    })
    .optional(),
});

const flatForwardedEmailSchema = z.object({
  to: z.string().trim().min(3).max(320),
  from: z.string().trim().min(3).max(320),
  messageId: optionalStringSchema,
  receivedAt: optionalStringSchema,
  subject: optionalStringSchema,
  textBody: optionalStringSchema,
  htmlBody: optionalStringSchema,
  snippet: optionalStringSchema,
  provider: optionalStringSchema,
});

export const forwardingProvisionRequestSchema = z
  .object({
    action: z.enum(["provision", "rotate_secret"]).default("provision"),
  })
  .default({
    action: "provision",
  });

const forwardingRecentEmailSchema = z.object({
  id: z.string(),
  fromEmail: z.string().nullable(),
  subject: z.string().nullable(),
  receivedAt: z.string().datetime(),
  signal: z.nativeEnum(InboundEmailSignal),
  processingStatus: z.nativeEnum(InboundEmailStatus),
  canonicalUrl: z.string().nullable(),
  snippet: z.string().nullable(),
});

const forwardingSourceSnapshotSchema = z.object({
  configured: z.boolean(),
  supportsDedicatedAddress: z.boolean(),
  source: z
    .object({
      id: z.string(),
      label: z.string(),
      status: z.nativeEnum(EmailIngestionConnectionStatus),
      forwardingLocalPart: z.string(),
      forwardingAddress: z.string().nullable(),
      webhookUrl: z.string().url(),
      lastIngestedAt: z.string().datetime().nullable(),
      receivedEmailCount: z.number().int().min(0),
    })
    .nullable(),
  recentEmails: z.array(forwardingRecentEmailSchema).max(10),
  instructions: z.array(z.string().trim().min(8).max(240)).min(3).max(6),
});

const forwardingProvisionResponseSchema = forwardingSourceSnapshotSchema.extend({
  forwardingSecret: z.string().min(16).max(128),
});

export type ForwardingSourceSnapshot = z.output<typeof forwardingSourceSnapshotSchema>;
export type ForwardingProvisionResponse = z.output<typeof forwardingProvisionResponseSchema>;

type NormalizedForwardedEmailPayload = {
  to: string;
  from: string;
  messageId: string | null;
  receivedAt: string | null;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  snippet: string | null;
  provider: string | null;
};

function getAppBaseUrl() {
  return process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}

function getForwardingDomain() {
  return process.env.EMAIL_FORWARDING_DOMAIN?.trim() || null;
}

function buildWebhookUrl() {
  return new URL(FORWARDING_WEBHOOK_PATH, getAppBaseUrl()).toString();
}

function buildForwardingAddress(localPart: string) {
  const domain = getForwardingDomain();

  if (!domain) {
    return null;
  }

  return `${localPart}@${domain}`;
}

function buildForwardingLocalPart() {
  return `jobs-${randomBytes(6).toString("hex")}`;
}

function buildForwardingSecret() {
  return randomBytes(24).toString("hex");
}

function hashForwardingSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string | null, length: number) {
  if (!value) {
    return null;
  }

  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function normalizeForwardingRecipient(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^([^@\s]+)@/);

  if (match) {
    return match[1];
  }

  return trimmed;
}

function normalizeForwardedPayload(input: unknown): NormalizedForwardedEmailPayload | null {
  const nested = nestedForwardedEmailSchema.safeParse(input);

  if (nested.success) {
    return {
      to: nested.data.envelope.to,
      from: nested.data.envelope.from,
      messageId: nested.data.envelope.messageId,
      receivedAt: nested.data.envelope.receivedAt,
      subject: nested.data.message.subject,
      textBody: nested.data.message.text,
      htmlBody: nested.data.message.html,
      snippet: nested.data.message.snippet,
      provider: nested.data.metadata?.provider ?? null,
    };
  }

  const flat = flatForwardedEmailSchema.safeParse(input);

  if (!flat.success) {
    return null;
  }

  return {
    to: flat.data.to,
    from: flat.data.from,
    messageId: flat.data.messageId,
    receivedAt: flat.data.receivedAt,
    subject: flat.data.subject,
    textBody: flat.data.textBody,
    htmlBody: flat.data.htmlBody,
    snippet: flat.data.snippet,
    provider: flat.data.provider,
  };
}

function extractSender(input: string) {
  const emailMatch = input.match(/<([^>]+)>/);
  const extractedEmail = emailMatch?.[1]?.trim() ?? input.trim();
  const name = input.includes("<")
    ? input.replace(/<[^>]+>/g, "").replace(/["']/g, "").trim()
    : null;

  return {
    email: extractedEmail.toLowerCase(),
    name: name || null,
  };
}

function createBodyPreview(textBody: string | null, htmlBody: string | null) {
  const candidate = textBody?.trim() || stripHtml(htmlBody ?? "");
  return truncate(candidate || null, PREVIEW_LENGTH);
}

function extractCanonicalUrl(input: Array<string | null | undefined>) {
  for (const candidate of input) {
    if (!candidate) {
      continue;
    }

    const match = candidate.match(URL_REGEX);

    if (match) {
      return match[0];
    }
  }

  return null;
}

function inferSignal(input: {
  fromEmail: string | null;
  subject: string | null;
  bodyPreview: string | null;
}) {
  const haystack = [input.fromEmail, input.subject, input.bodyPreview]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    haystack.includes("application") ||
    haystack.includes("candidature") ||
    haystack.includes("interview") ||
    haystack.includes("entretien")
  ) {
    return InboundEmailSignal.APPLICATION_UPDATE;
  }

  if (
    haystack.includes("recruiter") ||
    haystack.includes("talent acquisition") ||
    haystack.includes("talent") ||
    haystack.includes("sourcing")
  ) {
    return InboundEmailSignal.RECRUITER_OUTREACH;
  }

  if (
    haystack.includes("campus") ||
    haystack.includes("ecole") ||
    haystack.includes("universit") ||
    haystack.includes("forum")
  ) {
    return InboundEmailSignal.SCHOOL_CAREER_DIGEST;
  }

  if (
    haystack.includes("linkedin") ||
    haystack.includes("indeed") ||
    haystack.includes("jobteaser") ||
    haystack.includes("welcome to the jungle") ||
    haystack.includes("alerte") ||
    haystack.includes("job alert")
  ) {
    return InboundEmailSignal.JOB_ALERT;
  }

  if (
    haystack.includes("career") ||
    haystack.includes("careers") ||
    haystack.includes("jobs") ||
    haystack.includes("greenhouse") ||
    haystack.includes("workday") ||
    haystack.includes("lever")
  ) {
    return InboundEmailSignal.CAREER_SITE_DIGEST;
  }

  return InboundEmailSignal.UNKNOWN;
}

function buildInstructions(forwardingAddress: string | null) {
  const instructions = [
    "Provisionner un forwarding genere un secret unique et un point d ingestion HTTP cote serveur.",
    "Si un domaine de forwarding est configure, tu peux centraliser les alertes sur une adresse dediee par utilisateur.",
    "Sans domaine de forwarding, le webhook reste exploitable via un provider inbound ou un outil d automatisation.",
    "Le secret de forwarding n est affiche qu au moment de la generation et doit etre conserve cote utilisateur ou secret manager.",
  ];

  if (forwardingAddress) {
    instructions.splice(2, 0, `Adresse dediee disponible: ${forwardingAddress}.`);
  }

  return instructions;
}

async function buildSnapshot(userId: string): Promise<ForwardingSourceSnapshot> {
  const connection = await db.emailIngestionConnection.findUnique({
    where: {
      userId_sourceType: {
        userId,
        sourceType: EmailIngestionSourceType.FORWARDING,
      },
    },
    select: {
      id: true,
      label: true,
      status: true,
      forwardingLocalPart: true,
      forwardingAddress: true,
      lastIngestedAt: true,
      _count: {
        select: {
          inboundEmails: true,
        },
      },
      inboundEmails: {
        orderBy: {
          receivedAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          fromEmail: true,
          subject: true,
          receivedAt: true,
          signal: true,
          processingStatus: true,
          canonicalUrl: true,
          snippet: true,
        },
      },
    },
  });

  const forwardingAddress = connection?.forwardingAddress ?? null;

  return forwardingSourceSnapshotSchema.parse({
    configured: Boolean(connection?.forwardingLocalPart),
    supportsDedicatedAddress: Boolean(getForwardingDomain()),
    source: connection?.forwardingLocalPart
      ? {
          id: connection.id,
          label: connection.label,
          status: connection.status,
          forwardingLocalPart: connection.forwardingLocalPart,
          forwardingAddress,
          webhookUrl: buildWebhookUrl(),
          lastIngestedAt: connection.lastIngestedAt?.toISOString() ?? null,
          receivedEmailCount: connection._count.inboundEmails,
        }
      : null,
    recentEmails:
      connection?.inboundEmails.map((email) => ({
        id: email.id,
        fromEmail: email.fromEmail,
        subject: email.subject,
        receivedAt: email.receivedAt.toISOString(),
        signal: email.signal,
        processingStatus: email.processingStatus,
        canonicalUrl: email.canonicalUrl,
        snippet: email.snippet,
      })) ?? [],
    instructions: buildInstructions(forwardingAddress),
  });
}

export async function getForwardingSourceSnapshot(viewer: AuthenticatedViewer) {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);
  return buildSnapshot(authenticatedViewer.userId);
}

export async function provisionForwardingSource(
  viewer: AuthenticatedViewer,
): Promise<ForwardingProvisionResponse> {
  const authenticatedViewer = assertAuthenticatedViewer(viewer);
  const forwardingSecret = buildForwardingSecret();
  const webhookSecretHash = hashForwardingSecret(forwardingSecret);

  await db.$transaction(async (tx) => {
    const existing = await tx.emailIngestionConnection.findUnique({
      where: {
        userId_sourceType: {
          userId: authenticatedViewer.userId,
          sourceType: EmailIngestionSourceType.FORWARDING,
        },
      },
      select: {
        forwardingLocalPart: true,
      },
    });

    const forwardingLocalPart = existing?.forwardingLocalPart ?? buildForwardingLocalPart();

    await tx.emailIngestionConnection.upsert({
      where: {
        userId_sourceType: {
          userId: authenticatedViewer.userId,
          sourceType: EmailIngestionSourceType.FORWARDING,
        },
      },
      update: {
        label: FORWARDING_LABEL,
        status: EmailIngestionConnectionStatus.ACTIVE,
        forwardingLocalPart,
        forwardingAddress: buildForwardingAddress(forwardingLocalPart),
        webhookSecretHash,
      },
      create: {
        userId: authenticatedViewer.userId,
        sourceType: EmailIngestionSourceType.FORWARDING,
        label: FORWARDING_LABEL,
        status: EmailIngestionConnectionStatus.ACTIVE,
        forwardingLocalPart,
        forwardingAddress: buildForwardingAddress(forwardingLocalPart),
        webhookSecretHash,
      },
    });
  });

  const snapshot = await buildSnapshot(authenticatedViewer.userId);

  return forwardingProvisionResponseSchema.parse({
    ...snapshot,
    forwardingSecret,
  });
}

export async function ingestForwardedEmail(input: unknown, providedSecret: string | null) {
  if (!providedSecret) {
    return {
      ok: false as const,
      status: 401,
      error: "Missing forwarding secret",
    };
  }

  const normalizedPayload = normalizeForwardedPayload(input);

  if (!normalizedPayload) {
    return {
      ok: false as const,
      status: 400,
      error: "Invalid forwarding payload",
    };
  }

  const forwardingLocalPart = normalizeForwardingRecipient(normalizedPayload.to);

  const connection = await db.emailIngestionConnection.findUnique({
    where: {
      forwardingLocalPart,
    },
    select: {
      id: true,
      userId: true,
      webhookSecretHash: true,
    },
  });

  if (!connection?.webhookSecretHash) {
    return {
      ok: false as const,
      status: 404,
      error: "Forwarding source not found",
    };
  }

  if (hashForwardingSecret(providedSecret) !== connection.webhookSecretHash) {
    return {
      ok: false as const,
      status: 403,
      error: "Invalid forwarding secret",
    };
  }

  const sender = extractSender(normalizedPayload.from);
  const bodyPreview = createBodyPreview(normalizedPayload.textBody, normalizedPayload.htmlBody);
  const canonicalUrl = extractCanonicalUrl([
    normalizedPayload.textBody,
    normalizedPayload.htmlBody,
    normalizedPayload.snippet,
  ]);
  const signal = inferSignal({
    fromEmail: sender.email,
    subject: normalizedPayload.subject,
    bodyPreview,
  });
  const receivedAt = normalizedPayload.receivedAt
    ? new Date(normalizedPayload.receivedAt)
    : new Date();

  if (Number.isNaN(receivedAt.getTime())) {
    return {
      ok: false as const,
      status: 400,
      error: "Invalid receivedAt value",
    };
  }

  if (normalizedPayload.messageId) {
    const existing = await db.inboundEmail.findFirst({
      where: {
        connectionId: connection.id,
        externalMessageId: normalizedPayload.messageId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return {
        ok: true as const,
        status: 200,
        deduplicated: true,
        emailId: existing.id,
      };
    }
  }

  const email = await db.$transaction(async (tx) => {
    const created = await tx.inboundEmail.create({
      data: {
        userId: connection.userId,
        connectionId: connection.id,
        externalMessageId: normalizedPayload.messageId,
        fromEmail: sender.email,
        fromName: sender.name,
        toEmail: normalizedPayload.to.toLowerCase(),
        subject: truncate(normalizedPayload.subject, 300),
        bodyPreview,
        snippet:
          truncate(normalizedPayload.snippet, SNIPPET_LENGTH) ??
          truncate(bodyPreview, SNIPPET_LENGTH),
        canonicalUrl,
        signal,
        processingStatus: InboundEmailStatus.RECEIVED,
        receivedAt,
      },
      select: {
        id: true,
        signal: true,
        canonicalUrl: true,
        receivedAt: true,
      },
    });

    await tx.emailIngestionConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        lastIngestedAt: created.receivedAt,
        status: EmailIngestionConnectionStatus.ACTIVE,
      },
    });

    return created;
  });

  return {
    ok: true as const,
    status: 201,
    deduplicated: false,
    emailId: email.id,
    signal: email.signal,
    canonicalUrl: email.canonicalUrl,
  };
}
