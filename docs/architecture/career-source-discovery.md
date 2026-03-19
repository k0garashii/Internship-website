# Decouverte Des Pages Carrieres Et ATS

## Objectif

La tache `247` ajoute une etape intermediaire entre le ciblage d entreprises et la collecte d offres. Pour chaque entreprise cible, le systeme tente de trouver un point d entree public fiable vers les offres reelles: page carriere maison ou ATS connu.

## Entree

- liste d entreprises cibles issue de `GET/POST /api/profile/company-targets`
- pour chaque entreprise:
  - `companyName`
  - `websiteUrl`
  - `careerPageUrl` si deja connu
  - rationale et signaux pour l affichage

## Strategie de decouverte

L ordre de resolution est volontairement simple et explicable:

1. verifier la `careerPageUrl` deja fournie si elle existe
2. charger la home du site officiel et extraire les liens avec signaux `careers`, `jobs`, `join-us`, `recrutement`, `emploi`, `talent`
3. tenter une liste courte de chemins frequents:
   - `/careers`
   - `/jobs`
   - `/join-us`
   - `/recrutement`
   - `/emploi`
4. classifier l URL finale si elle ressemble a un ATS connu

## ATS detectes

Le classifieur actuel reconnait:

- Greenhouse
- Lever
- SmartRecruiters
- Workday
- Recruitee
- Ashby
- Teamtailor
- Jobvite
- Welcome to the Jungle
- Taleo

## Sortie

La route `POST /api/profile/company-targets/discovery` retourne:

- `generatedAt`
- `summary`
- `results`

Chaque resultat contient:

- `companyName`
- `websiteUrl`
- `careerPageUrl`
- `status`
- `discoveryMethod`
- `confidence`
- `atsProvider`
- `checkedUrls`
- `notes`

## Limites volontaires

- la decouverte repose sur du HTML public et des heuristiques d URL
- aucune navigation navigateur ou rendu JavaScript n est utilise a ce stade
- certains sites avec protection anti-bot ou routage front-only ne seront pas resolus
- la sortie est un point d entree de collecte, pas encore une extraction d offres detaillees

## Usage produit

- l utilisateur genere d abord des entreprises cibles depuis `/workspace/search`
- il lance ensuite `Decouvrir les pages carrieres / ATS`
- l interface affiche le statut, la methode, la confiance et l ATS detecte
- cette etape prepare les futures collectes directes sur sites carrieres proprietaires
