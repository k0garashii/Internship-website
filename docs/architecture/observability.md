# Observabilite

## But

Rendre visibles:

- les erreurs route/service deja normalisees
- les evenements critiques du parcours utilisateur
- les executions de recherche cote produit

## Signaux en place

- `[route-error]`: erreurs HTTP structurees avec route, statut, requete et details d erreur
- `[service-error]`: erreurs internes cote service avec scope et metadata
- `[route-event]`: evenements de succes ou de demarrage sur les routes critiques
- `[service-event]`: evenements de service sans erreur

## Evenements actuellement traces

- inscription utilisateur
- connexion utilisateur
- demarrage d une collecte `/api/search/discovery`
- fin d une collecte avec `offerCount`, `executedQueryCount`, `persistedOfferCount` et `searchRunId`

## Correlation produit

La persistance des recherches ajoute en plus une trace produit durable via:

- `SearchRun`
- `SearchRunOffer`
- `JobOffer`

Les logs console servent donc a diagnostiquer le runtime, tandis que les tables Prisma
servent a expliquer ce qui a ete effectivement collecte et classe pour l utilisateur.
