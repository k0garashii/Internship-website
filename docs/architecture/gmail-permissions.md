# Gmail Permissions, Revocation And Delivery

## Goal

This document captures the current Gmail integration contract:

- Google OAuth connection for mailbox reading
- incremental permission upgrade for draft creation and sending
- local revocation behavior
- production caveats around Google verification

## Scopes Used

### Base Identity

- `openid`
- `email`
- `profile`

Used to identify the Google account and persist the linked mailbox.

### Mailbox Read

- `https://www.googleapis.com/auth/gmail.readonly`

Used to:

- read mailbox profile
- list messages
- fetch message metadata
- infer candidate replies from synchronized threads

### Draft And Send Upgrade

- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/gmail.send`

Requested only when the user explicitly wants to create Gmail drafts or send directly from the app.

## Incremental Authorization Flow

1. The user first connects Gmail in read mode.
2. The app stores the Google account, OAuth tokens and Gmail mailbox connection.
3. If the user wants draft/send actions later, the app reopens Google OAuth with the broader scope set.
4. The granted scopes are merged locally so the mailbox sync keeps working after the upgrade.

## Local Revocation Behavior

Disconnecting Gmail in the app currently does the following:

- disables the Gmail `EmailIngestionConnection`
- detaches the Gmail connection from the app flow
- clears local access token, refresh token and id token

This is intentionally conservative on the app side. A stricter future version can also call the Google token revocation endpoint.

## Delivery Routes

Current server routes:

- `GET /api/email/google/connect`
- `GET /api/email/google/callback`
- `GET /api/email/google/connection`
- `PATCH /api/email/google/settings`
- `POST /api/email/google/sync`
- `POST /api/email/google/disconnect`
- `POST /api/email/drafts/[draftId]/gmail-draft`
- `POST /api/email/drafts/[draftId]/gmail-send`

## Verification Caveat

For small-scale testing, OAuth can run with a limited test audience. For a larger rollout, Gmail scopes may require Google app verification before production use at scale.

## Current Product Guarantee

Reply detection is based on synchronized Gmail threads, not only on messages sent through the application. This means the system can still detect responses when:

- the user wrote from Gmail directly
- the user wrote from another Gmail client
- the company answered after an ATS submission
