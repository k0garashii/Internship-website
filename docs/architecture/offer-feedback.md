# Offer Feedback

## Purpose

Let the user attach an explicit relevance decision to each persisted offer.

## Entry point

- `POST /api/search/offers/[offerId]/feedback`

Request body:

```json
{
  "decision": "FAVORITE",
  "note": "Optional note"
}
```

## Supported decisions

- `FAVORITE`
- `MAYBE`
- `NOT_RELEVANT`

## Persistence strategy

Feedback is stored in `OfferFeedback`, scoped by user and offer.

If a feedback row already exists for the same user and offer, the most recent one is
updated. Otherwise a new row is created.

## Frontend behavior

The persisted-offers section on `/workspace/search` now exposes:

- quick decision buttons
- an optional note textarea

After save, the page refreshes so the latest feedback chip and note stay aligned with the
persisted state.
