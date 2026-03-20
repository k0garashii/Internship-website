# Email Personalization Prompt

## Purpose

Define the reusable Gemini prompt pair used to transform a retained offer context into a
draft application email.

## Current implementation

The prompt builder lives in `apps/web/src/lib/email/personalization-prompt.ts`.

It returns:

- `systemPrompt`
- `userPrompt`

## System prompt rules

The system prompt enforces:

- French output
- sober, concise and credible tone
- no hallucinated facts
- no mention of AI, internal scores or hidden system behavior
- no markdown or bullets in the final email body
- fixed output contract with:
  - `SUBJECT:`
  - `BODY:`

## User prompt content

The user prompt serializes the validated `OfferGeminiContext` into three blocks:

- candidate context
- offer context
- internal signals

It also includes the concrete drafting instruction:

- produce a concise personalized application email
- rely only on provided information
- highlight at most three strong alignment axes

## Why this split

- `OfferGeminiContext` stays responsible for data quality and completeness
- `personalization-prompt.ts` stays responsible for model behavior and output framing

This keeps the next implementation step small: the future draft-generation route will only
need to load context, build prompts, call Gemini and persist the returned draft.
