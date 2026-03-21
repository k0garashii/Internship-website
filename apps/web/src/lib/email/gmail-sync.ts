import {
  EmailIngestionConnectionStatus,
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
import {
  buildMailboxProfessionalContext,
  classifyProfessionalMailboxMessage,
} from "@/lib/email/mailbox-professional-filter";
import { gmailSyncResultSchema, type GmailSyncResult } from "@/lib/email/mailbox-sync";
import { normalizeConversationSubject, recomputeOfferMailboxSignals } from "@/lib/email/mailbox-replies";
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

function extractStoredLabelIds(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return [] as string[];
  }

  const labelIds = (rawPayload as { labelIds?: unknown }).labelIds;

  if (!Array.isArray(labelIds)) {
    return [] as string[];
  }

  return labelIds.filter((value): value is string => typeof value === "string");
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
    const mailboxContext = await buildMailboxProfessionalContext(userId);

    let createdMessageCount = 0;
    let updatedMessageCount = 0;
    let filteredOutMessageCount = 0;

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
      const classification = classifyProfessionalMailboxMessage(
        {
          direction,
          labelIds: detail.labelIds ?? [],
          subject,
          snippet,
          fromEmail: from.email,
          fromName: from.name,
          toEmails,
          ccEmails,
          canonicalUrl,
        },
        mailboxContext,
      );
      const signal = classification.signal;
      const processingStatus = classification.processingStatus;

      if (!classification.isProfessional) {
        filteredOutMessageCount += 1;
        continue;
      }

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
            classification: {
              professionalScore: classification.professionalScore,
              reasons: classification.reasons,
            },
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
            classification: {
              professionalScore: classification.professionalScore,
              reasons: classification.reasons,
            },
          },
        },
      });

      if (existing) {
        updatedMessageCount += 1;
      } else {
        createdMessageCount += 1;
      }
    }

    const storedMessages = await db.mailboxMessage.findMany({
      where: {
        userId,
        connectionId: connection.id,
      },
      select: {
        id: true,
        direction: true,
        subject: true,
        snippet: true,
        fromEmail: true,
        fromName: true,
        toEmails: true,
        ccEmails: true,
        canonicalUrl: true,
        rawPayload: true,
      },
      take: 250,
      orderBy: [
        {
          receivedAt: "desc",
        },
        {
          sentAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const staleMessageIds = storedMessages
      .filter((message) => {
        const classification = classifyProfessionalMailboxMessage(
          {
            direction: message.direction,
            labelIds: extractStoredLabelIds(message.rawPayload),
            subject: message.subject,
            snippet: message.snippet,
            fromEmail: message.fromEmail,
            fromName: message.fromName,
            toEmails: Array.isArray(message.toEmails)
              ? message.toEmails.filter(
                  (value): value is string => typeof value === "string",
                )
              : [],
            ccEmails: Array.isArray(message.ccEmails)
              ? message.ccEmails.filter(
                  (value): value is string => typeof value === "string",
                )
              : [],
            canonicalUrl: message.canonicalUrl,
          },
          mailboxContext,
        );

        return !classification.isProfessional;
      })
      .map((message) => message.id);

    if (staleMessageIds.length > 0) {
      await db.mailboxMessage.deleteMany({
        where: {
          id: {
            in: staleMessageIds,
          },
        },
      });
      filteredOutMessageCount += staleMessageIds.length;
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
        filteredOutMessageCount,
        detectedReplyCount: replyDetection.detectedReplyCount,
      },
    });

    return gmailSyncResultSchema.parse({
      syncedAt: syncedAt.toISOString(),
      processedMessageCount: messageIds.length,
      createdMessageCount,
      updatedMessageCount,
      filteredOutMessageCount,
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
