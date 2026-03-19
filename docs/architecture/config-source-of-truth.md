# Source de verite DB et fichiers

## Decision

La base utilisateur est la source de verite primaire du produit.

Les trois fichiers historiques:

- `personal_profile`
- `search_targets`
- `company_watchlist`

restent des artefacts d import/export et de portabilite, mais plus la reference
principale de l application web.

## Pourquoi

- l application est multi-utilisateur et doit raisonner sur un `userId`
- l interface web modifie deja directement l etat persiste
- la generation de domaines et les futures recherches doivent lire un etat unique
- les fichiers restent utiles pour bootstrap, backup, partage et edition hors app

## Regles de synchronisation

1. Une sauvegarde depuis l interface web met a jour la base uniquement.
2. Un export projette l etat courant de la base vers les trois formats de fichier.
3. Un import remplace explicitement la ou les sections fournies par le fichier importe.
4. Les sections non importees restent inchangées.
5. En cas de conflit entre fichier et base, l import explicite gagne pour la section importee.

## Impact pratique

- l onboarding et la page preferences pilotent l etat courant
- `GET /api/config/export` fournit une projection des trois fichiers
- `POST /api/config/import` permet de rejouer un ou plusieurs fichiers vers la base

## Points ouverts mais bornes

- aucun merge fin ligne a ligne n est implemente pour l instant
- l import est pense comme un remplacement par section
- la journalisation des imports pourra etre ajoutee plus tard si besoin

## Fichiers relies

- `apps/web/src/lib/config/user-config.ts`
- `apps/web/src/lib/profile/onboarding.ts`
- `docs/architecture/personal-profile-schema.md`
- `docs/architecture/search-targets-schema.md`
- `docs/architecture/company-watchlist-schema.md`
