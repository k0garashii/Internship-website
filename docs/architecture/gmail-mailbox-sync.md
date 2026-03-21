# Gmail Mailbox Sync

## Intent

This document captures the first technical slice of the Gmail-first strategy:

- model a Gmail connection independently from local auth
- keep a sync cursor for incremental mailbox reads
- store synchronized mailbox messages from both directions
- prepare later inference of candidate conversations and responses

## Why Not Rely On App-Sent Message IDs

Relying on messages sent from the app would miss common cases:

- the user applied directly from Gmail
- the user replied from a mobile mail client
- the application was submitted through an ATS or a company form
- a recruiter wrote first without an app-generated thread

The source of truth becomes the synchronized mailbox, not a local outbox owned by the app.

## Data Model

### EmailIngestionConnection

Extended with Gmail sync fields:

- `authAccountId`
- `mailboxAddress`
- `syncCursor`
- `syncQuery`
- `syncLabel`
- `lastSyncedAt`
- `lastSyncError`

This keeps the connection generic enough for Gmail first, Outlook later, and forwarding as fallback.

### MailboxMessage

New message snapshot model storing:

- provider message id
- provider thread id
- direction `INBOUND` / `OUTBOUND`
- sender and recipients
- normalized subject
- snippet
- canonical URL
- signal and processing status
- sent / received timestamps

The product can later derive candidate conversations from these snapshots without assuming that the app initiated them.

## Sync Rules

- Gmail sync must be incremental using a provider cursor
- sync must be targetable by label or explicit query
- the first MVP stores only the metadata and short content needed for classification
- attachments are out of scope

## Follow-up Implementation

- connect Google account with incremental Gmail scopes
- fetch mailbox pages incrementally
- normalize Gmail headers and labels into the snapshot model
- infer candidate response status from thread and subject continuity

## Current Implementation

The first full slice is now wired in the application:

- `GET /api/email/google/connect` starts Google OAuth for mailbox read or mailbox + send
- `GET /api/email/google/callback` persists the Google account and Gmail connection
- `POST /api/email/google/sync` refreshes mailbox snapshots
- synchronized Gmail messages populate `MailboxMessage`
- inferred reply statuses populate `OfferMailboxSignal`
- `POST /api/email/drafts/[draftId]/gmail-draft` creates a Gmail draft
- `POST /api/email/drafts/[draftId]/gmail-send` sends through Gmail
