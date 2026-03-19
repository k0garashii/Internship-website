# Modele de donnees multi-utilisateur

## Objectif

Definir une base relationnelle unique qui couvre:

- utilisateurs et authentification
- profil candidat et competences
- domaines, cibles et localisations de recherche
- recherches lancees et offres normalisees
- feedback utilisateur
- brouillons d'email relies aux offres

## Principes de modelisation

1. Toute donnee metier mutable appartient a un `User`.
2. L'isolation future se base d'abord sur des cles `userId` explicites sur chaque table metier.
3. Les recherches et les offres sont decouplees via une table de jointure pour garder l'historique des runs, des scores et des classements.
4. Les brouillons d'email restent relies a l'offre source pour conserver le contexte de personnalisation.

## Entites principales

### Authentification

- `User`: compte principal, email, statut, locale, timezone.
- `AuthAccount`: comptes federes ou externes par fournisseur.
- `AuthSession`: sessions actives et expiration.
- `VerificationToken`: tokens one-shot pour verification ou magic link.

### Profil et configuration

- `UserProfile`: coeur du `personal_profile`.
- `ProfileSkill`: competences normalisees rattachees au profil.
- `CompanyWatchlistItem`: projection multi-utilisateur de `company_watchlist`.
- `SearchDomain`: domaines valides ou proposes a l'utilisateur.
- `SearchTarget`: titres de postes ou types de cibles.
- `SearchLocation`: localisations et preferences remote/hybrid.

### Recherche et offres

- `SearchRun`: execution d'une recherche avec snapshot de filtres.
- `JobOffer`: offre normalisee, dedupee par utilisateur via `fingerprint`.
- `SearchRunOffer`: lien entre une recherche et une offre, avec score, rang et explication.

### Boucle de decision

- `OfferFeedback`: retour utilisateur sur la pertinence ou l'avancement.
- `EmailDraft`: brouillon associe a une offre, pret pour validation humaine.

## Relations critiques

- `User` 1-1 `UserProfile`
- `UserProfile` 1-n `ProfileSkill`
- `User` 1-n `SearchDomain`, `SearchTarget`, `SearchLocation`, `CompanyWatchlistItem`
- `User` 1-n `SearchRun`
- `User` 1-n `JobOffer`
- `SearchRun` n-n `JobOffer` via `SearchRunOffer`
- `JobOffer` 1-n `OfferFeedback`
- `JobOffer` 1-n `EmailDraft`

## Pourquoi cette forme

- Elle couvre la definition de terminee de la tache 20 sans attendre l'implementation auth.
- Elle prepare directement les taches 30 a 100 du backlog.
- Elle garde un modele suffisamment normalise pour le scoring et la deduplication, sans sur-decouper le domaine trop tot.

## Isolation

Les regles d'acces et de cloisonnement applicatif qui s'appuient sur ce schema sont formalisees dans `docs/architecture/data-isolation.md`.

## Fichiers lies

- `apps/web/prisma/schema.prisma`
- `apps/web/src/lib/db.ts`
- `apps/web/.env.example`
