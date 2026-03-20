# Persistance Des Offres Et Runs

## Objectif

La tache `260` fait passer la recherche d offres d une simple previsualisation a une vraie persistance exploitable pour l historique, la deduplication et le matching.

## Ce Qui Est Stocke

- un `SearchRun` par execution de `/api/search/discovery`
- un `JobOffer` par opportunite fusionnee cote utilisateur
- un lien `SearchRunOffer` entre le run et les offres retenues

## Champs Persistes

Chaque `JobOffer` retient au minimum:

- la source et l URL
- l identifiant externe si disponible
- le `fingerprint` commun
- le titre, l entreprise, la localisation
- le type de contrat et le mode de travail quand disponibles
- la description exploitable
- le `rawPayload` complet de la collecte et de la normalisation

## Run De Recherche

Le `SearchRun` stocke:

- un libelle horodate
- les requetes executees
- le resume de plan
- les providers et warnings
- le nombre de resultats rattaches

## Etat Produit

La reponse `POST /api/search/discovery` expose maintenant un bloc `persistence` avec:

- `searchRunId`
- `persistedOfferCount`
- `createdOfferCount`
- `updatedOfferCount`

## Suite

- `270`: fusionner les doublons inter-sources et re-publications
- `280`: formaliser le scoring durable sur les offres persistees
