import {
  EmailDeliveryOperation,
  EmailDeliveryLogStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { getRequiredActiveWorkspaceIdForUser } from "@/server/application/workspace/workspace-service";

const emailDeliveryLogListItemSchema = z.object({
  id: z.string().trim().min(10),
  provider: z.string().trim().min(1),
  operation: z.nativeEnum(EmailDeliveryOperation),
  status: z.nativeEnum(EmailDeliveryLogStatus),
  recipientEmail: z.string().trim().email(),
  subject: z.string().trim().max(200).nullable(),
  bodyPreview: z.string().trim().max(240).nullable(),
  errorMessage: z.string().trim().max(500).nullable(),
  providerDraftId: z.string().trim().min(1).nullable(),
  providerMessageId: z.string().trim().min(1).nullable(),
  providerThreadId: z.string().trim().min(1).nullable(),
  createdAt: z.string().datetime(),
  draft: z
    .object({
      id: z.string().trim().min(10),
      status: z.string().trim().min(1),
      subject: z.string().trim().max(200).nullable(),
    })
    .nullable(),
});

export type EmailDeliveryLogListItem = z.output<
  typeof emailDeliveryLogListItemSchema
>;

type DeliveryLogPayload = {
  userId: string;
  workspaceId?: string | null;
  emailDraftId?: string | null;
  provider: string;
  operation: EmailDeliveryOperation;
  status: EmailDeliveryLogStatus;
  recipientEmail: string;
  subject?: string | null;
  bodyPreview?: string | null;
  errorMessage?: string | null;
  providerDraftId?: string | null;
  providerMessageId?: string | null;
  providerThreadId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

function truncate(value: string | null | undefined, length: number) {
  if (!value) {
    return null;
  }

  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

export async function createEmailDeliveryLog(input: DeliveryLogPayload) {
  const workspaceId =
    input.workspaceId ?? (await getRequiredActiveWorkspaceIdForUser(input.userId));

  return db.emailDeliveryLog.create({
    data: {
      userId: input.userId,
      workspaceId,
      emailDraftId: input.emailDraftId ?? null,
      provider: input.provider,
      operation: input.operation,
      status: input.status,
      recipientEmail: input.recipientEmail,
      subject: truncate(input.subject, 200),
      bodyPreview: truncate(input.bodyPreview, 240),
      errorMessage: truncate(input.errorMessage, 500),
      providerDraftId: input.providerDraftId ?? null,
      providerMessageId: input.providerMessageId ?? null,
      providerThreadId: input.providerThreadId ?? null,
      metadata: input.metadata ?? undefined,
    },
    select: {
      id: true,
      provider: true,
      operation: true,
      status: true,
      recipientEmail: true,
      subject: true,
      bodyPreview: true,
      errorMessage: true,
      providerDraftId: true,
      providerMessageId: true,
      providerThreadId: true,
      createdAt: true,
      emailDraft: {
        select: {
          id: true,
          status: true,
          subject: true,
        },
      },
    },
  });
}

export async function listEmailDeliveryLogsForUser(userId: string, limit = 12) {
  const logs = await db.emailDeliveryLog.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    select: {
      id: true,
      provider: true,
      operation: true,
      status: true,
      recipientEmail: true,
      subject: true,
      bodyPreview: true,
      errorMessage: true,
      providerDraftId: true,
      providerMessageId: true,
      providerThreadId: true,
      createdAt: true,
      emailDraft: {
        select: {
          id: true,
          status: true,
          subject: true,
        },
      },
    },
  });

  return logs.map((log) =>
    emailDeliveryLogListItemSchema.parse({
      id: log.id,
      provider: log.provider,
      operation: log.operation,
      status: log.status,
      recipientEmail: log.recipientEmail,
      subject: log.subject,
      bodyPreview: log.bodyPreview,
      errorMessage: log.errorMessage,
      providerDraftId: log.providerDraftId,
      providerMessageId: log.providerMessageId,
      providerThreadId: log.providerThreadId,
      createdAt: log.createdAt.toISOString(),
      draft: log.emailDraft
        ? {
            id: log.emailDraft.id,
            status: log.emailDraft.status,
            subject: log.emailDraft.subject,
          }
        : null,
    }),
  );
}
