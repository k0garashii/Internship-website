# InternshipScrapper

Socle de recherche de stage et d emploi, organise comme une application SaaS modulaire autour d une application web Next.js.

## Stack retenue

- Frontend: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4
- Backend: Route Handlers Next.js, plus couches serveur `facades / application / domain / infrastructure`
- Donnees: PostgreSQL + Prisma 6
- Validation: schemas TypeScript, Zod, tests unitaires et e2e

## Pourquoi ce choix

- Une seule application debloque vite l auth, le profil utilisateur, les APIs internes et le deploiement.
- Le pattern BFF de Next.js reste adapte au produit, mais il est maintenant structure comme un backend SaaS modulaire.
- La structure `apps/web` + `packages/client-common` laisse une porte propre pour ajouter d autres clients, un worker dedie et des integrations commerciales.

## Architecture SaaS en place

- `apps/web/src/server/facades`: points d entree backend par domaine
- `apps/web/src/server/application`: cas d usage, orchestration, jobs et bootstrap workspace
- `apps/web/src/server/domain`: catalogues auth, permissions et billing
- `apps/web/src/server/infrastructure`: acces Prisma partage
- `packages/client-common`: premiers contrats client communs

Le backend reste heberge dans `apps/web`, mais il n est plus organise comme un simple bloc de logique dans `src/lib`.

## Structure actuelle

- `apps/web`: application web full-stack
- `apps/web/src/server`: couches backend SaaS
- `packages/client-common`: package de contrats client communs
- `.github/workflows`: CI/CD GitHub Actions de base
- `apps/web/src/app/workspace/workspace`: centre de pilotage du workspace
- `docs/architecture/backend-facades.md`: structuration backend en facades et couches serveur
- `docs/architecture/workspaces-and-entitlements.md`: bootstrap workspace, plans, abonnements et feature flags
- `docs/architecture/jobs-and-worker.md`: file de jobs applicative et worker minimal
- `docs/architecture/ci-cd.md`: workflows GitHub Actions et prerequis de deploiement
- `docs/architecture/stack.md`: decision technique et implications pour le backlog
- `docs/architecture/data-model.md`: modele de donnees multi-utilisateur cible
- `docs/architecture/data-isolation.md`: regles d isolation des donnees par utilisateur
- `docs/architecture/company-targeting.md`: passage du profil vers une liste d entreprises cibles
- `docs/architecture/career-source-discovery.md`: detection automatique des pages carrieres et ATS a partir des entreprises cibles
- `docs/architecture/offer-discovery.md`: collecte multi-sources sur job boards publics, recherche web approfondie et pages carrieres
- `docs/architecture/gmail-mailbox-sync.md`: modele cible pour connecter Gmail, synchroniser la boite et suivre les reponses
- `docs/architecture/inferred-profile-model.md`: separation entre profil declare, profil infere et garde-fous de personnalisation
- `docs/architecture/inferred-profile-signals.md`: catalogue des signaux comportementaux a capter pour apprendre les preferences reelles
- `docs/architecture/deployment.md`: procedure GitHub, Vercel et Supabase pour le deploiement initial
- `docs/architecture/saas-transition-roadmap.md`: ecart entre le monolithe initial et la cible SaaS modulaire

## Commandes

```bash
npm run dev
npm run lint
npm run build
npm run test
npm run worker
npm run jobs:drain -- --once
npm run personas:notion
npm run personas:seed
npm run personas:evaluate
npm run ci:check
```

## Etat du produit

- Authentification par email et mot de passe avec session HTTP-only
- Catalogue `AuthN` explicite cote serveur pour les providers internes et OAuth
- Provisionnement automatique d un `Workspace` personnel a l inscription ou a la premiere session
- Creation du workspace personnel durcie pour rester idempotente meme si plusieurs composants le resolvent en parallele
- Abonnement `FREE` bootstrappe automatiquement avec `Plan`, `WorkspaceSubscription` et `BillingEvent`
- Resolution d entitlements par workspace pour la collecte, Gmail, brouillons et enrichissement
- Ecran workspace avec switcher, membres visibles, etat commercial et health checks providers
- Invitations workspace avec lien d acceptation et edition des roles pour owner/admin
- Les donnees applicatives majeures sont maintenant rattachees a un `workspaceId` en plus du `userId`
- Onboarding utilisateur avec sauvegarde et rechargement du profil en base
- L enrichissement du profil est maintenant declenche via une file de jobs applicative
- Worker minimal disponible pour `PROFILE_ENRICHMENT_REFRESH`, `SEARCH_DISCOVERY_RUN` et `GMAIL_SYNC`
- Profil implicite en place: modele `profil declare / profil infere / garde-fous`, persistance des evenements comportementaux, recalcul du profil infere et mesure d impact
- Les signaux implicites sont maintenant reinjectes dans le scoring des offres, le ciblage d entreprises et la page de diagnostic `/workspace/profile/inference`
- La page de diagnostic du profil implicite est en cours de clarte produit: intensite lisible, confiance moins permissive et raisons reformulees pour un humain
- Les clics sur offres, ouvertures d entreprises cibles, pages ATS et temps passe sur une annonce sont captes via `/api/search/interactions`
- Les diagnostics exposent aussi une mesure de convergence des derniers runs pour verifier si la pertinence des resultats progresse au fil des interactions
- Strategie email Gmail-first pour la lecture des reponses et candidatures, avec forwarding dedie conserve comme fallback MVP
- API `GET/PATCH /api/profile` pour relire et mettre a jour le profil utilisateur
- API `GET/POST /api/profile/company-targets` et `POST /api/profile/company-targets/discovery` pour generer des entreprises cibles et detecter leurs pages carrieres / ATS
- API `GET /api/search/plan`, `GET/POST /api/search/discovery`, `GET /api/search/history` et `GET /api/search/offers`
- Recherche d offres multi-sources: Welcome to the Jungle, LinkedIn Jobs en direct, lecture de pages carrieres / ATS, puis recherche web classifiee pour faire remonter d autres job boards publics comme Indeed, France Travail, HelloWork, Apec, Cadremploi ou Talent.com quand ils sont accessibles
- Fallback web pour retrouver la page carriere / ATS d une entreprise quand la home ou les chemins communs ne suffisent pas
- API `POST /api/search/offers/[offerId]/feedback` pour enregistrer un feedback explicite par offre
- API Gmail pour connecter la boite, synchroniser les messages, creer des brouillons et envoyer des mails
- Brouillons de candidature persists en `EmailDraft`, avec fallback deterministe si Gemini echoue
- Catalogue de personas multi-secteurs disponible pour la revue, avec seed local reproductible via scripts
- Routes critiques recherche / Gmail / brouillons / company targeting protegees par les entitlements du workspace
- Logs structures de succes et d erreur sur les routes sensibles
- Ecrans `/workspace/search`, `/workspace/email` et `/workspace/drafts` relies au backend persistant
- CI GitHub Actions de base pour Prisma, lint, tests et build

## Verification recente

- `npx prisma db push`
- `npm run lint`
- `npm run test`
- `npm run build`

## Personas de test

- `apps/web/src/lib/testing/personas.ts`: source de verite des personas multi-secteurs
- `npm run personas:notion`: publie ou met a jour la page Notion de revue des personas
- `npm run personas:seed`: cree ou met a jour les comptes de test dans l application
- `npm run personas:evaluate`: lance la phase de test multi-personas sur le serveur local et produit un rapport dans `.codex-artifacts/persona-evaluation`
- Le catalogue courant couvre volontairement des secteurs non numeriques: sante publique, espaces verts, RH, logistique, hotellerie et qualite agroalimentaire
- Chaque persona embarque maintenant une personnalite, un sous-secteur de predilection, des entreprises favorites et une checklist de verification pour la review et les tests
- Le rapport multi-personas rejoue deux rounds d apprentissage implicite par profil afin de mesurer la convergence des suggestions et des offres
- La phase de test personas sert aussi a verifier que l elargissement des sources web ameliore la couverture et la pertinence hors WTTJ
- Le seed retourne les emails injectes en base avec un mot de passe commun reserve au test local

## Prochaines etapes SaaS

- `N1`: finaliser l idempotence et les tests du bootstrap workspace
- `N2`: terminer le passage des lectures restantes vers un scope `workspaceId`
- `N3`: etendre les checks providers au demarrage et aux providers externes
- `H1`: ouvrir le vrai multi-workspace en plus du switcher deja pose
- `H2`: ajouter la suppression de membres et l envoi automatise des invitations
- `J1`: brancher un vrai provider de billing
- `K1`: passer la collecte d offres en jobs asynchrones
- `L1`: clarifier score et confiance du profil implicite
- `L2`: humaniser les diagnostics d inference et les evenements dominants
- `L3`: documenter les limites du profil implicite et ses sources de signal
