# Facades Backend

Le backend reste heberge dans `apps/web`, mais il est maintenant structure en couches server-side:

- `src/server/facades`: points d entree metier exposes aux routes
- `src/server/application`: orchestration des cas d usage
- `src/server/domain`: contrats d auth, permissions et billing
- `src/server/infrastructure`: dependances techniques partagees comme Prisma

Facades en place:

- `auth-facade`: inscription, session et bootstrap workspace
- `search-facade`: verification des entitlements puis collecte et persistance
- `email-facade`: verification des entitlements sur Gmail et generation de brouillons
- `profile-facade`: orchestration des jobs d enrichissement
- `billing-facade`: vue synthese billing + entitlements
