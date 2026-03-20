# Parsing Des Emails En Opportunites

## Objectif

La tache `252` transforme les emails entrants deja stockes en opportunites structurees compatibles avec le pipeline commun defini par `250`.

## Principe

1. l intake forwarding continue de stocker un message entrant minimal
2. une couche de parsing heuristique classe le message
3. le message est marque `PARSED` ou `IGNORED`
4. si le signal est exploitable, le message est projete dans `NormalizedOpportunity`

## Signaux Pris En Charge

- `JOB_ALERT`
- `CAREER_SITE_DIGEST`
- `RECRUITER_OUTREACH`
- `SCHOOL_CAREER_DIGEST`

Les emails de suivi de candidature (`APPLICATION_UPDATE`) sont conserves mais exclus du pipeline d opportunites.

## Projection Produite

Le parseur alimente les champs communs suivants quand ils peuvent etre deduits de facon raisonnable:

- `title`
- `companyName`
- `sourceKind`
- `sourceProvider`
- `sourceLabel`
- `description`
- `sourceUrl`
- `publishedAt`

Le parsing reste volontairement conservateur: quand l email ne porte pas assez de signal fiable, il est marque `IGNORED` au lieu d inventer une opportunite.

## Heuristiques

- detection du canal a partir du domaine expediteur, du lien principal et du signal initial
- deduction de l entreprise depuis le sujet, le corps, le nom expediteur ou le domaine de destination
- deduction du titre depuis le sujet nettoye
- exclusion des emails de statut de candidature

## Limites Volontaires

- un email peut encore representer plusieurs offres dans un digest, mais le MVP ne projette qu une opportunite principale
- pas de lecture du HTML complet ni des pieces jointes
- pas encore de persistance dans `JobOffer` a cette etape

## Fichiers Cles

- `apps/web/src/lib/email/opportunities.ts`
- `apps/web/src/lib/email/forwarding.ts`
- `apps/web/src/lib/search/normalization.ts`
- `/workspace/email`

## Suite

- `260`: persister les offres trouvees et leur source
- `270`: dedupliquer les opportunites web et email
