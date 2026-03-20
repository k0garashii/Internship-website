# Matching Profil Offre

## Objectif

La tache `290` ajoute un vrai moteur de matching interpretable entre le profil utilisateur et chaque offre collectee.

## Entrees

- `personal_profile`
- `search_targets`
- l offre normalisee / enrichie par la collecte

## Criteres Du Matching

- alignement avec les roles cibles
- recoupement competences / mots cles
- alignement domaines
- adequation localisation / remote
- adequation type de contrat
- adequation seniorite

## Sortie

Chaque offre expose maintenant un bloc `matching` avec:

- `score`
- `label`
- `summary`
- `breakdown[]`

Le `breakdown` detaille les points attribues et les termes qui ont justifie chaque critere.

## Persistance

Le score de matching alimente maintenant:

- `SearchRunOffer.rawScore`
- `SearchRunOffer.normalizedScore`
- `SearchRunOffer.matchExplanation`

## Fichiers Cles

- `apps/web/src/lib/search/matching.ts`
- `apps/web/src/lib/search/discovery.ts`
- `apps/web/src/lib/search/persistence.ts`

## Suite

- `310`: classer les offres retenues par pertinence
- `340`: exposer les offres classees via API
