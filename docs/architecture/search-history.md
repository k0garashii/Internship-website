# Search History

## Purpose

Expose the runs already executed by a user so the product can display a stable search
history with status, volume and a small preview of the best results.

## Entry points

- `GET /api/search/history`
- `/workspace/search`

## Returned data

Each run exposes:

- identity: `id`, `label`
- runtime state: `status`, `startedAt`, `completedAt`, `createdAt`, `errorMessage`
- search payload: `queryText`
- volume: `resultCount`
- top results preview: `topOffers[]` with `title`, `companyName`, `sourceUrl`, `rank`,
  `matchScore`

## Query strategy

History is read from `SearchRun`, scoped to the authenticated user and ordered by
`createdAt desc`.

For each run, the API also loads the first 3 `SearchRunOffer` entries ordered by rank,
which gives the UI a compact summary of what the run actually surfaced.

## Frontend behavior

The history is rendered server-side on `/workspace/search`, after the live discovery
section and the persisted offers section. Because the live search panel triggers
`router.refresh()` after a successful run, the history refreshes automatically when a
new search is launched.
