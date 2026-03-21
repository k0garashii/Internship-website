import {
  EmailIngestionConnectionStatus,
  InboundEmailSignal,
  InboundEmailStatus,
  MailboxMessageDirection,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  ensureGmailConnectionAccess,
  getDefaultGmailSyncQuery,
  getGmailConnectionSnapshot,
  GmailMailboxError,
} from "@/lib/email/gmail-connection";
import {
  type GmailMessageDetail,
  getGmailMessage,
  getGmailProfile,
  listGmailHistory,
  listGmailMessages,
  GOOGLE_OAUTH_SCOPES,
  GoogleIntegrationError,
} from "@/lib/email/google";
import { gmailSyncResultSchema, type GmailSyncResult } from "@/lib/email/mailbox-sync";
import { normalizeConversationSubject, recomputeOfferMailboxSignals } from "@/lib/email/mailbox-replies";
import {
  type InboundEmailOpportunityCandidate,
  parseInboundEmailOpportunity,
} from "@/lib/email/opportunities";
import { logServiceError, logServiceEvent } from "@/lib/observability/error-logging";

const URL_REGEX = /https?:\/\/[^\s"'<>]+/i;
const GMAIL_SYNC_LIMIT = 40;

function truncate(value: string | null | undefined, length: number) {
  if (!value) {
    return null;
  }

  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function getHeaderValue(message: GmailMessageDetail, headerName: string) {
  return (
    message.payload?.headers?.find((header) => header.name.toLowerCase() === headerName.toLowerCase())
      ?.value ?? null
  );
}

function splitAddressList(value: string | null) {
  if (!value) {
    return [] as string[];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSender(value: string | null) {
  if (!value) {
    return {
      email: null,
      name: null,
    };
  }

  const match = value.match(/(.*)<([^>]+)>/);

  if (match) {
    return {
      name: match[1].replace(/["']/g, "").trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }

  return {
    name: null,
    email: value.trim().toLowerCase(),
  };
}

function parseAddressEmails(value: string | null) {
  return splitAddressList(value)
    .map((entry) => parseSender(entry).email)
    .filter((email): email is string => Boolean(email));
}

function extractCanonicalUrl(input: Array<string | null | undefined>) {
  for (const value of input) {
    if (!value) {
      continue;
    }

    const match = value.match(URL_REGEX);

    if (match) {
      return match[0];
    }
  }

  return null;
}

function inferMailboxSignal(input: {
  direction: MailboxMessageDirection;
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  toEmails: string[];
}) {
  const haystack = [input.subject, input.snippet, input.fromEmail, ...input.toEmails]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    haystack.includes("application") ||
    haystack.includes("candidature") ||
    haystack.includes("entretien") ||
    haystack.includes("interview") ||
    haystack.includes("thank you for applying")
  ) {
    return InboundEmailSignal.APPLICATION_UPDATE;
  }

  if (
    haystack.includes("linkedin") ||
    haystack.includes("jobteaser") ||
    haystack.includes("indeed") ||
    haystack.includes("welcome to the jungle") ||
    haystack.includes("job alert") ||
    haystack.includes("alerte")
  ) {
    return InboundEmailSignal.JOB_ALERT;
  }

  if (
    haystack.includes("greenhouse") ||
    haystack.includes("workday") ||
    haystack.includes("lever") ||
    haystack.includes("ashby") ||
    haystack.includes("career") ||
    haystack.includes("careers")
  ) {
    return InboundEmailSignal.CAREER_SITE_DIGEST;
  }

  if (
    haystack.includes("recruiter") ||
    haystack.includes("talent") ||
    haystack.includes("sourcing") ||
    haystack.includes("hiring")
  ) {
    return InboundEmailSignal.RECRUITER_OUTREACH;
  }

  if (
    haystack.includes("ecole") ||
    haystack.includes("campus") ||
    haystack.includes("forum") ||
    haystack.includes("universit")
  ) {
    return InboundEmailSignal.SCHOOL_CAREER_DIGEST;
  }

  if (input.direction === MailboxMessageDirection.OUTBOUND) {
    return InboundEmailSignal.APPLICATION_UPDATE;
  }

  return InboundEmailSignal.UNKNOWN;
}

function buildOpportunityCandidate(input: {
  id: string;
  signal: InboundEmailSignal;
  subject: string | null;
  snippet: string | null;
  canonicalUrl: string | null;
  receivedAt: Date;
  fromEmail: string | null;
  fromName: string | null;
}): InboundEmailOpportunityCandidate {
  return {
    id: input.id,
    signal: input.signal,
    subject: input.subject,
    snippet: input.snippet,
    bodyPreview: input.snippet,
    canonicalUrl: input.canonicalUrl,
    receivedAt: input.receivedAt,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
  };
}

function inferProcessingStatus(input: {
  direction: MailboxMessageDirection;
  id: string;
  signal: InboundEmailSignal;
  subject: string | null;
  snippet: string | null;
  canonicalUrl: string | null;
  receivedAt: Date;
  fromEmail: string | null;
  fromName: string | null;
}) {
  if (input.direction === MailboxMessageDirection.OUTBOUND) {
    return InboundEmailStatus.IGNORED;
  }

  return parseInboundEmailOpportunity(buildOpportunityCandidate(input)).processingStatus;
}

function toTimestamp(message: GmailMessageDetail) {
  const headerDate = getHeaderValue(message, "Date");

  if (headerDate) {
    const parsed = new Date(headerDate);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (message.internalDate) {
    const parsed = new Date(Number(message.internalDate));

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

async function listMessageIds(accessToken: string, syncCursor: string | null, syncQuery: string) {
  let usedHistoryCursor = false;

  if (syncCursor) {
    try {
      let pageToken: string | null = null;
      const messageIds = new Set<string>();

      do {
        const page = await listGmailHistory({
          accessToken,
          startHistoryId: syncCursor,
          pageToken,
          maxResults: 100,
        });

        for (const historyItem of page.history ?? []) {
          for (const messageAdded of historyItem.messagesAdded ?? []) {
            messageIds.add(messageAdded.message.id);
          }
        }

        pageToken = page.nextPageToken ?? null;
      } while (pageToken && messageIds.size < GMAIL_SYNC_LIMIT);

      usedHistoryCursor = true;
      return {
        messageIds: Array.from(messageIds).slice(0, GMAIL_SYNC_LIMIT),
        usedHistoryCursor,
      };
    } catch (error) {
      if (!(error instanceof GoogleIntegrationError) || error.status !== 404) {
        throw error;
      }
    }
  }

  let pageToken: string | null = null;
  const ids = new Set<string>();

  do {
    const page = await listGmailMessages({
      accessToken,
      query: syncQuery,
      pageToken,
      maxResults: 25,
    });

    for (const item of page.messages ?? []) {
      ids.add(item.id);
    }

    pageToken = page.nextPageToken ?? null;
  } while (pageToken && ids.size < GMAIL_SYNC_LIMIT);

  return {
    messageIds: Array.from(ids).slice(0, GMAIL_SYNC_LIMIT),
    usedHistoryCursor,
  };
}

export async function syncGmailMailbox(userId: string): Promise<GmailSyncResult> {
  const { connection, accessToken } = await ensureGmailConnectionAccess({
    userId,
    requiredScopes: [...GOOGLE_OAUTH_SCOPES.mailbox],
  });

  try {
    const profile = await getGmailProfile(accessToken);
    const syncQuery = connection.syncQuery?.trim() || getDefaultGmailSyncQuery();
    const { messageIds, usedHistoryCursor } = await listMessageIds(
      accessToken,
      connection.syncCursor,
      syncQuery,
    );

    let createdMessageCount = 0;
    let updatedMessageCount = 0;

    for (const messageId of messageIds) {
      const detail = await getGmailMessage(accessToken, messageId);
      const from = parseSender(getHeaderValue(detail, "From"));
      const toEmails = parseAddressEmails(getHeaderValue(detail, "To"));
      const ccEmails = parseAddressEmails(getHeaderValue(detail, "Cc"));
      const subject = truncate(getHeaderValue(detail, "Subject"), 300);
      const snippet = truncate(detail.snippet ?? null, 1800);
      const canonicalUrl = extractCanonicalUrl([
        snippet,
        getHeaderValue(detail, "References"),
        getHeaderValue(detail, "In-Reply-To"),
      ]);
      const direction =
        detail.labelIds?.includes("SENT") || from.email === profile.emailAddress.toLowerCase()
          ? MailboxMessageDirection.OUTBOUND
          : MailboxMessageDirection.INBOUND;
      const timestamp = toTimestamp(detail);
      const signal = inferMailboxSignal({
        direction,
        subject,
        snippet,
        fromEmail: from.email,
        toEmails,
      });
      const processingStatus = inferProcessingStatus({
        direction,
        id: detail.id,
        signal,
        subject,
        snippet,
        canonicalUrl,
        receivedAt: timestamp,
        fromEmail: from.email,
        fromName: from.name,
      });

      const existing = await db.mailboxMessage.findUnique({
        where: {
          connectionId_providerMessageId: {
            connectionId: connection.id,
            providerMessageId: detail.id,
          },
        },
        select: {
          id: true,
        },
      });

      await db.mailboxMessage.upsert({
        where: {
          connectionId_providerMessageId: {
            connectionId: connection.id,
            providerMessageId: detail.id,
          },
        },
        update: {
          providerThreadId: detail.threadId,
          direction,
          folderLabel: detail.labelIds?.join(",") ?? null,
          subject,
          normalizedSubject: normalizeConversationSubject(subject),
          snippet,
          fromEmail: from.email,
          fromName: from.name,
          toEmails,
          ccEmails,
          canonicalUrl,
          signal,
          processingStatus,
          sentAt: direction === MailboxMessageDirection.OUTBOUND ? timestamp : null,
          receivedAt: direction === MailboxMessageDirection.INBOUND ? timestamp : null,
          rawPayload: {
            labelIds: detail.labelIds ?? [],
            headers: detail.payload?.headers ?? [],
          },
        },
        create: {
          userId,
          connectionId: connection.id,
          providerMessageId: detail.id,
          providerThreadId: detail.threadId,
          direction,
          folderLabel: detail.labelIds?.join(",") ?? null,
          subject,
          normalizedSubject: normalizeConversationSubject(subject),
          snippet,
          fromEmail: from.email,
          fromName: from.name,
          toEmails,
          ccEmails,
          canonicalUrl,
          signal,
          processingStatus,
          sentAt: direction === MailboxMessageDirection.OUTBOUND ? timestamp : null,
          receivedAt: direction === MailboxMessageDirection.INBOUND ? timestamp : null,
          rawPayload: {
            labelIds: detail.labelIds ?? [],
            headers: detail.payload?.headers ?? [],
          },
        },
      });

      if (existing) {
        updatedMessageCount += 1;
      } else {
        createdMessageCount += 1;
      }
    }

    const replyDetection = await recomputeOfferMailboxSignals(userId);
    const syncedAt = new Date();

    await db.emailIngestionConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        mailboxAddress: profile.emailAddress,
        syncCursor: profile.historyId,
        syncQuery,
        lastSyncedAt: syncedAt,
        lastSyncError: null,
        status: EmailIngestionConnectionStatus.ACTIVE,
      },
    });

    const snapshot = await getGmailConnectionSnapshot(userId);

    logServiceEvent({
      scope: "email/gmail-sync",
      message: "Gmail mailbox synchronized",
      metadata: {
        userId,
        processedMessageCount: messageIds.length,
        createdMessageCount,
        updatedMessageCount,
        detectedReplyCount: replyDetection.detectedReplyCount,
      },
    });

    return gmailSyncResultSchema.parse({
      syncedAt: syncedAt.toISOString(),
      processedMessageCount: messageIds.length,
      createdMessageCount,
      updatedMessageCount,
      detectedReplyCount: replyDetection.detectedReplyCount,
      usedHistoryCursor,
      snapshot,
    });
  } catch (error) {
    await db.emailIngestionConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        status: EmailIngestionConnectionStatus.ERROR,
        lastSyncError:
          error instanceof Error ? truncate(error.message, 500) : "Gmail sync failed unexpectedly",
      },
    });

    logServiceError({
      scope: "email/gmail-sync",
      message: "Gmail synchronization failed",
      error,
      metadata: {
        userId,
      },
    });

    if (error instanceof GmailMailboxError || error instanceof GoogleIntegrationError) {
      throw error;
    }

    throw new GmailMailboxError("La synchronisation Gmail a echoue", 500);
  }
}
