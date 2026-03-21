import {
  EmailIngestionConnectionStatus,
  EmailIngestionSourceType,
  InboundEmailSignal,
  InboundEmailStatus,
  MailboxMessageDirection,
  MailboxReplyStatus,
} from "@prisma/client";
import { z } from "zod";

export const mailboxSyncTargetSchema = z.object({
  sourceType: z.enum(["GMAIL", "OUTLOOK"]),
  mailboxAddress: z.string().trim().email(),
  syncLabel: z.string().trim().max(120).nullish().transform((value) => value || null),
  syncQuery: z.string().trim().max(240).nullish().transform((value) => value || null),
});

export const mailboxSyncConnectionSnapshotSchema = z.object({
  id: z.string().trim().min(10),
  userId: z.string().trim().min(10),
  sourceType: z.nativeEnum(EmailIngestionSourceType),
  status: z.nativeEnum(EmailIngestionConnectionStatus),
  mailboxAddress: z.string().trim().email().nullable(),
  syncCursor: z.string().trim().min(1).nullable(),
  syncLabel: z.string().trim().min(1).nullable(),
  syncQuery: z.string().trim().min(1).nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  lastSyncError: z.string().trim().min(1).nullable(),
});

export const mailboxMessageSnapshotSchema = z.object({
  id: z.string().trim().min(10),
  providerMessageId: z.string().trim().min(1),
  providerThreadId: z.string().trim().min(1).nullable(),
  direction: z.nativeEnum(MailboxMessageDirection),
  subject: z.string().trim().max(300).nullable(),
  normalizedSubject: z.string().trim().max(300).nullable(),
  snippet: z.string().trim().max(2000).nullable(),
  fromEmail: z.string().trim().email().nullable(),
  fromName: z.string().trim().max(160).nullable(),
  toEmails: z.array(z.string().trim().email()).max(20).default([]),
  ccEmails: z.array(z.string().trim().email()).max(20).default([]),
  canonicalUrl: z.string().trim().url().nullable(),
  signal: z.nativeEnum(InboundEmailSignal),
  processingStatus: z.nativeEnum(InboundEmailStatus),
  sentAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime().nullable(),
});

export const offerMailboxSignalSnapshotSchema = z.object({
  id: z.string().trim().min(10),
  jobOfferId: z.string().trim().min(10),
  jobOfferTitle: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  status: z.nativeEnum(MailboxReplyStatus),
  confidence: z.number().min(0).max(1),
  summary: z.string().trim().max(500).nullable(),
  providerThreadId: z.string().trim().min(1).nullable(),
  detectedAt: z.string().datetime(),
  latestMessage: mailboxMessageSnapshotSchema.nullable(),
});

export const gmailConnectionSnapshotSchema = z.object({
  oauthConfigured: z.boolean(),
  configured: z.boolean(),
  source: z
    .object({
      id: z.string(),
      status: z.nativeEnum(EmailIngestionConnectionStatus),
      mailboxAddress: z.string().trim().email().nullable(),
      syncQuery: z.string().trim().max(240).nullable(),
      lastSyncedAt: z.string().datetime().nullable(),
      lastSyncError: z.string().trim().max(500).nullable(),
      grantedScopes: z.array(z.string().trim().min(1)).max(20),
      hasMailboxScope: z.boolean(),
      hasSendScope: z.boolean(),
      messageCount: z.number().int().min(0),
      responseSignalCount: z.number().int().min(0),
    })
    .nullable(),
  recentMessages: z.array(mailboxMessageSnapshotSchema).max(15),
  detectedReplies: z.array(offerMailboxSignalSnapshotSchema).max(15),
  instructions: z.array(z.string().trim().min(8).max(240)).min(3).max(8),
});

export const gmailSyncResultSchema = z.object({
  syncedAt: z.string().datetime(),
  processedMessageCount: z.number().int().min(0),
  createdMessageCount: z.number().int().min(0),
  updatedMessageCount: z.number().int().min(0),
  filteredOutMessageCount: z.number().int().min(0),
  detectedReplyCount: z.number().int().min(0),
  usedHistoryCursor: z.boolean(),
  snapshot: gmailConnectionSnapshotSchema,
});

export type MailboxSyncTarget = z.output<typeof mailboxSyncTargetSchema>;
export type MailboxSyncConnectionSnapshot = z.output<
  typeof mailboxSyncConnectionSnapshotSchema
>;
export type MailboxMessageSnapshot = z.output<typeof mailboxMessageSnapshotSchema>;
export type OfferMailboxSignalSnapshot = z.output<
  typeof offerMailboxSignalSnapshotSchema
>;
export type GmailConnectionSnapshot = z.output<typeof gmailConnectionSnapshotSchema>;
export type GmailSyncResult = z.output<typeof gmailSyncResultSchema>;
