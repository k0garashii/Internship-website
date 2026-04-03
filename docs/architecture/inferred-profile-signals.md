# Signaux a capter pour construire le profil implicite

## Objectif

Definir une liste de signaux observables, priorisee et exploitable techniquement, pour apprendre ce qui correspond reellement a l utilisateur.

## Regle generale

Plus le signal demande un engagement de l utilisateur ou conduit a un resultat concret, plus il doit peser.

## Niveaux de force

### Signaux faibles

- consultation du plan de recherche
- lancement d une recherche

Ces signaux servent surtout a comprendre l intention courante.

### Signaux moyens

- ouverture d une offre
- consultation detaillee d une offre
- ouverture d une entreprise cible
- ouverture d une page ATS

Ces signaux servent a reprioriser les pistes, sans conclure trop vite.

### Signaux forts

- sauvegarde d une offre
- suppression d une offre
- feedback `Pertinente`
- feedback `A revoir`
- feedback `Non pertinente`
- generation d un brouillon

Ces signaux peuvent faire monter ou baisser un axe de preference.

### Signaux outcome

- email envoye
- reponse recue
- entretien enregistre
- refus enregistre
- offre acceptee

Ce sont les signaux les plus fiables pour verifier si la personnalisation va dans la bonne direction.

## Axes affectes par type de signal

- `ROLE`: recherches, clics offres, feedback, candidatures, outcomes
- `DOMAIN`: recherches, clics, feedback, entreprises consultees, outcomes
- `KEYWORD`: requetes, plan de recherche, detail d offres, feedback
- `TECHNOLOGY`: detail d offres, feedback, brouillons, outcomes
- `COMPANY`: entreprises consultees, ATS ouverts, brouillons, emails, outcomes
- `LOCATION`: recherches, clics, feedback, candidatures
- `OUTCOME`: reponses, entretiens, refus, acceptations

## Catalogue v1

Le catalogue code existe dans:

- `apps/web/src/lib/profile/personalization-signals.ts`
- `packages/client-common/src/profile-personalization.ts`

Les types retenus sont:

- `SEARCH_PLAN_VIEWED`
- `SEARCH_EXECUTED`
- `SEARCH_RESULT_OPENED`
- `SEARCH_RESULT_EXPANDED`
- `COMPANY_TARGET_OPENED`
- `ATS_SOURCE_OPENED`
- `OFFER_SAVED`
- `OFFER_DELETED`
- `OFFER_FEEDBACK_FAVORITE`
- `OFFER_FEEDBACK_MAYBE`
- `OFFER_FEEDBACK_NOT_RELEVANT`
- `DRAFT_GENERATED`
- `EMAIL_SENT`
- `EMAIL_REPLY_RECEIVED`
- `INTERVIEW_RECORDED`
- `REJECTION_RECORDED`
- `OFFER_ACCEPTED_RECORDED`

## Ce que cette etape ne fait pas encore

- aucune persistance en base
- aucun recalcul du profil implicite
- aucun impact direct sur le scoring actuel

Cette etape fixe le contrat et la priorisation des signaux avant de toucher au schema.
