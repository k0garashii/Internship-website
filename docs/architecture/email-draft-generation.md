# Email Draft Generation

## Purpose

Generate and persist a first application email draft from a retained offer, the user
profile and the internal matching signals.

## Entry point

- `POST /api/email/drafts/generate`

Request body:

```json
{
  "jobOfferId": "..."
}
```

## Pipeline

1. Load the validated `OfferGeminiContext`
2. Build the `systemPrompt` and `userPrompt`
3. Call Gemini with a JSON response contract (`subject`, `body`)
4. Fallback to a deterministic template if Gemini is unavailable
5. Persist the resulting `EmailDraft`

## Persistence

Each generated draft stores:

- `userId`
- `jobOfferId`
- `status = DRAFT`
- `subject`
- `body`
- `personalizationSummary`
- `generatedBy`
- `contextSnapshot`

## Frontend behavior

The persisted-offers section on `/workspace/search` now exposes a `Generer un brouillon`
action on each offer card.

For the current MVP, the generated subject and body are previewed inline directly in the
offer card. The dedicated review screen remains a separate next step.
