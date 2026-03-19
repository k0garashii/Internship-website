# Isolation des donnees par utilisateur

## Objectif

Garantir qu'aucune donnee metier d'un utilisateur ne soit lisible, modifiable ou supprimable par un autre utilisateur.

## Regles obligatoires

1. Toute route privee commence par resoudre un `viewer` authentifie.
2. Toute lecture de donnee metier filtre explicitement par `userId`.
3. Toute ecriture sur une donnee metier verifie que la ressource cible appartient deja au `viewer`.
4. Aucun endpoint prive ne fait de lecture par identifiant seul sur une table metier possedee par un utilisateur.
5. Les tables sans `userId` direct ne sont accessibles qu'en passant par un parent deja scope par `userId`.
6. Les tables d'auth globales restent separees des tables metier, mais les sessions et comptes federes restent rattaches a un seul `User`.
7. Les logs et erreurs ne doivent jamais exposer le contenu d'une ressource non possedee; on retourne une erreur generique de type `404` ou `403`.
8. Toute operation multi-table sensible passe par une transaction si elle peut contourner l'isolation par une ecriture partielle.

## Application au schema actuel

### Tables lues ou ecrites directement avec `userId`

- `UserProfile`
- `CompanyWatchlistItem`
- `SearchDomain`
- `SearchTarget`
- `SearchLocation`
- `SearchRun`
- `JobOffer`
- `OfferFeedback`
- `EmailDraft`
- `AuthSession`
- `AuthAccount`

Sur ces tables, les routes doivent toujours utiliser un predicat du type `where: { userId: viewer.userId, ... }`.

### Tables a acces indirect

- `ProfileSkill`: acces via `UserProfile`.
- `SearchRunOffer`: acces via `SearchRun` ou `JobOffer`.
- `VerificationToken`: table systeme, jamais exposee a un endpoint utilisateur authentifie.

Pour ces tables, l'API ne doit pas accepter un acces direct fonde uniquement sur leur `id`.

## Regles de requetage Prisma

### Interdit

- `findUnique({ where: { id } })` sur une table metier possedee par un utilisateur
- `update({ where: { id } })`
- `delete({ where: { id } })`

### Autorise

- `findFirst({ where: { id, userId: viewer.userId } })`
- `updateMany({ where: { id, userId: viewer.userId }, data: ... })`
- lecture via relation deja possedee par le `viewer`

## Regles d'API

1. Le `userId` cible ne vient jamais du client pour une route privee; il vient de la session.
2. Les handlers serveur ne retournent jamais de liste non scopee.
3. Toute pagination conserve le predicat `userId`.
4. Les filtres fournis par le client s'ajoutent au scope utilisateur, ils ne le remplacent jamais.

## Regles de service

1. Les helpers de data access doivent fournir des fonctions de scope reutilisables.
2. Les services qui manipulent une offre, un feedback ou un brouillon doivent valider la coherence des `userId` relies.
3. Les futurs workers de collecte ne pourront ecrire que dans le contexte explicite d'un utilisateur et d'un `SearchRun`.

## Regles de surface produit

1. Une route qui ne trouve pas une ressource non possedee ne doit pas reveler si cette ressource existe chez quelqu'un d'autre.
2. Les tableaux de bord, profils, offres et brouillons affichent uniquement des donnees du `viewer`.
3. Les exports et imports doivent etre limites au perimetre du `viewer`.

## Defenses complementaires prevues

- contraintes et index par `userId` dans le schema Prisma
- helpers serveur centralises de scoping
- tests d'autorisation sur les futures routes
- eventuelle RLS PostgreSQL plus tard comme defense en profondeur, pas comme seul garde-fou

## Fichiers relies

- `apps/web/prisma/schema.prisma`
- `apps/web/src/lib/auth/viewer.ts`
- `apps/web/src/lib/security/ownership.ts`
