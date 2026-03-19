# Normalisation Des Opportunites

## Objectif

La tache `250` introduit un format interne commun pour les opportunites, afin de ne plus laisser chaque source imposer sa propre structure. Le but est d uniformiser au minimum:

- titre
- entreprise
- localisation
- description
- URL source
- date
- provenance

## Format Commun

Le format normalise contient notamment:

- `origin`
- `sourceKind`
- `sourceProvider`
- `sourceLabel`
- `title`
- `companyName`
- `locationLabel`
- `countryCode`
- `contractType`
- `workMode`
- `description`
- `sourceUrl`
- `publishedAt`
- `capturedAt`
- `fingerprint`

## Sources Couverts

### Offres web

Le MVP mappe les offres `Welcome to the Jungle` detectees dans la collecte publique vers ce format commun.

### Emails

Le mapping des emails entrants existe deja dans la meme couche, meme s il n est pas encore branche a une API de parsing final. Cela prepare la tache `252`.

## Implementation

- `apps/web/src/lib/search/normalization.ts`
- `apps/web/src/lib/search/types.ts`
- `apps/web/src/lib/search/discovery.ts`

La route `GET/POST /api/search/discovery` retourne maintenant:

- les `offers` brutes dedupliquees
- les `normalizedOffers` derivees du meme run

## Limites Volontaires

- pas encore de persistance en base de ces opportunites normalisees
- pas encore de fusion multi-sources complete
- pas encore de mapping salary, seniority ou stack technique en champs dedies

## Suite Preparee

- `252`: transformer les emails entrants en opportunites structurees
- `260`: persister les offres et les runs
- `270`: dedupliquer inter-sources
