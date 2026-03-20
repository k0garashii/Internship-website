# Formule De Scoring Des Offres

## Objectif

La tache `280` formalise une premiere formule de scoring lisible et stable pour classer les opportunites avant le matching plus fin de `290`.

## Score De Base

Toute offre valide commence a `36` points.

## Criteres Et Poids

- correspondance avec les requetes du plan: `+18` par requete convergente, cap `36`
- mots cles retrouves: `+7` par mot cle, cap `28`
- type de contrat stage / alternance: `+10`
- extrait profil de poste disponible: `+6`
- resume source disponible: `+4`
- fraicheur:
  - moins de 7 jours: `+10`
  - moins de 21 jours: `+6`
  - moins de 45 jours: `+3`

## Bornes

- score minimum renvoye: `35`
- score maximum renvoye: `98`

## Labels

- `85+`: `Tres forte`
- `72+`: `Forte`
- `58+`: `Intermediaire`
- sinon: `Exploratoire`

## Perimetre

Cette formule sert aujourd hui a la collecte initiale pour:

- ordonner les offres web dedupliquees
- alimenter `SearchRunOffer.rawScore`
- garder une base commune avant le matching profil-offre complet

## Fichier Cle

- `apps/web/src/lib/search/scoring.ts`

## Suite

- `290`: ajouter un vrai matching profil-offre sur la base des offres dedupliquees et persistees
