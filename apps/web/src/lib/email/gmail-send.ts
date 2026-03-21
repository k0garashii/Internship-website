import {
  EmailDeliveryOperation,
  EmailDeliveryLogStatus,
} from "@prisma/client";
import { z } from "zod";

import { ensureGmailConnectionAccess, GmailMailboxError } from "@/lib/email/gmail-connection";
import { createEmailDeliveryLog, listEmailDeliveryLogsForUser, type EmailDeliveryLogListItem } from "@/lib/email/delivery-logs";
import { GOOGLE_OAUTH_SCOPES, sendGmailMessage } from "@/lib/email/google";
import { logServiceError, logServiceEvent } from "@/lib/observability/error-logging";

const adhocGmailSendInputSchema = z.object({
  recipientEmail: z.string().trim().email(),
  subject: z.string().trim().min(4).max(160),
  body: z.string().trim().min(20).max(4000),
});

export type GmailAdhocSendInput = z.infer<typeof adhocGmailSendInputSchema>;

export class GmailSendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GmailSendError";
  }
}

export type GmailSendResult = {
  deliveryLog: EmailDeliveryLogListItem;
  logs: EmailDeliveryLogListItem[];
};

export async function sendAdhocGmailMessage(
  userId: string,
  input: unknown,
): Promise<GmailSendResult> {
  const parsed = adhocGmailSendInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new GmailSendError("Payload d envoi Gmail invalide", 400);
  }

  try {
    const { accessToken } = await ensureGmailConnectionAccess({
      userId,
      requiredScopes: [...GOOGLE_OAUTH_SCOPES.compose],
    });
    const sent = await sendGmailMessage({
      accessToken,
      to: parsed.data.recipientEmail,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });

    const created = await createEmailDeliveryLog({
      userId,
      provider: "gmail",
      operation: EmailDeliveryOperation.ADHOC_GMAIL_SEND,
      status: EmailDeliveryLogStatus.SUCCESS,
      recipientEmail: parsed.data.recipientEmail,
      subject: parsed.data.subject,
      bodyPreview: parsed.data.body,
      providerMessageId: sent.id ?? null,
      providerThreadId: sent.threadId ?? null,
      metadata: {
        labelIds: sent.labelIds ?? [],
      },
    });

    logServiceEvent({
      scope: "email/gmail-send",
      message: "Ad hoc Gmail message sent",
      metadata: {
        userId,
        recipientEmail: parsed.data.recipientEmail,
        providerMessageId: sent.id ?? null,
      },
    });

    return {
      deliveryLog: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        draft: created.emailDraft,
      },
      logs: await listEmailDeliveryLogsForUser(userId),
    };
  } catch (error) {
    await createEmailDeliveryLog({
      userId,
      provider: "gmail",
      operation: EmailDeliveryOperation.ADHOC_GMAIL_SEND,
      status: EmailDeliveryLogStatus.FAILED,
      recipientEmail: parsed.data.recipientEmail,
      subject: parsed.data.subject,
      bodyPreview: parsed.data.body,
      errorMessage: error instanceof Error ? error.message : "Ad hoc Gmail send failed",
    });

    logServiceError({
      scope: "email/gmail-send",
      message: "Ad hoc Gmail send failed",
      error,
      metadata: {
        userId,
        recipientEmail: parsed.data.recipientEmail,
      },
    });

    if (error instanceof GmailMailboxError) {
      throw new GmailSendError(error.message, error.status);
    }

    throw new GmailSendError("Impossible d envoyer le mail via Gmail", 500);
  }
}
