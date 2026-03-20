# Offer Listing

## Purpose

Expose the offers already persisted in PostgreSQL so the frontend can display a stable
inventory of opportunities and their current state independently from the last live
search response.

## Current entry points

- `GET /api/search/offers`
- `/workspace/search`

## Response contract

The API returns:

- `generatedAt`
- `summary`
- `offerCount`
- `statusCounts`
- `offers[]`

Each offer exposes the minimal fields the UI needs to render a list with state:

- identity: `id`, `title`, `companyName`, `sourceSite`, `sourceUrl`
- placement: `locationLabel`
- lifecycle: `lifecycleStatus`
- freshness: `postedAt`, `firstSeenAt`, `lastSeenAt`
- latest search context: `latestMatchScore`, `latestRank`, `latestSearchRunId`,
  `latestSearchLabel`, `latestSearchStatus`, `matchExplanation`
- user state: `isShortlisted`, `latestFeedbackDecision`, `latestFeedbackNote`

## Query strategy

The listing reads `JobOffer` scoped to the authenticated user and enriches each offer with:

- the latest `SearchRunOffer`
- the latest `OfferFeedback`

Sorting is currently based on:

1. `lastSeenAt desc`
2. `createdAt desc`

This keeps the list focused on the freshest opportunities while still exposing the
latest rank and match score from the most recent search run.

## Frontend behavior

`/workspace/search` renders a dedicated persisted-offers section below the live discovery
panel. After a search run, the client triggers `router.refresh()` so the server-rendered
listing stays aligned with the newly persisted data.
