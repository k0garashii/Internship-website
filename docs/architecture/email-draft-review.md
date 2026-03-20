# Email Draft Review

## Purpose

Provide a dedicated screen where the user can read, edit and copy the generated drafts
before using them outside the application.

## Entry points

- `/workspace/drafts`
- `GET /api/email/drafts`
- `PATCH /api/email/drafts/[draftId]`

## Current behavior

The page lists all drafts of the authenticated user and shows for each draft:

- status
- generation source
- linked offer
- personalization summary
- editable subject
- editable body

Actions currently available:

- `Sauvegarder`
- `Copier`

## Save behavior

Saving a draft updates:

- `subject`
- `body`
- `status = READY_FOR_REVIEW`

## Copy behavior

Copy uses `navigator.clipboard` and copies:

1. the subject
2. a blank line
3. the full body
