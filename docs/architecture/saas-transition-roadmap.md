# Transition vers une architecture SaaS

## Lecture du schema cible

Le schema fourni vise une architecture SaaS simple et modulaire:

- un backend unique
- plusieurs facades metier exposees via une API
- des services transverses relies au backend:
  - `AuthN`
  - `AuthZ`
  - `BDD`
  - `Billing`
  - `Services metier`
- un `client commun` capable d alimenter plusieurs clients:
  - `web`
  - `mobile`
  - `desktop`
- une `landing page`
- une brique `CI/CD`

## Etat actuel du projet

Le projet est deja partiellement aligne avec ce schema:

- `apps/web` joue deja le role de client web + backend BFF
- `app/api` existe deja comme surface API
- `src/lib/auth`, `src/lib/profile`, `src/lib/search`, `src/lib/email` sont deja des noyaux metier distincts
- `PostgreSQL + Prisma` couvrent deja la brique `BDD`
- `observability`, `deployment` et la connexion Vercel/Supabase posent deja une base d exploitation
- la landing page existe deja

## Statut apres la passe SaaS

Les blocs suivants sont maintenant poses dans le code:

- `A1` et `A2`: facades backend + separation `facades / application / domain / infrastructure`
- `B1` et `B2`: premier catalogue `AuthN` et centralisation initiale des gardes `AuthZ`
- `C1` et `C2`: `Workspace` personnel, abonnement `FREE`, entitlements et rattachement des donnees principales
- `D1` et `D2`: facade billing interne minimale, plans, subscriptions et billing events
- `E1`: package `client-common` cree
- `F1` et `F2`: queue Postgres applicative et worker minimal
- `G1` et `G2`: CI/CD GitHub Actions de base

Ce qui reste surtout a faire concerne maintenant l experience multi-workspace, le billing reel, l execution async plus large et la consommation multi-client du package partage.

Ce qui manque encore pour ressembler au schema SaaS:

- une vraie couche `facade` explicite entre `app/api` et les services metier
- une abstraction provider pour `AuthN` et `AuthZ`
- une vraie brique `Billing`
- un `client commun` partageable hors web
- une structure orientee multi-client et multi-tenant plus nette
- une vraie brique `CI/CD`

## Ce qu il ne faut pas changer tout de suite

Il ne faut pas perdre du temps sur ces points tant qu ils ne servent pas le produit:

- separer le backend dans un service distinct juste pour "faire SaaS"
- creer des apps mobile ou desktop maintenant
- introduire des microservices
- sur-architecturer la couche CDN au dela de Vercel tant qu il n y a pas de contrainte reelle

Le bon compromis est de garder `Next.js` comme point d entree unique, mais d y introduire les bons decoupages internes.

## Roadmap recommandee

### Bloc L - Lisibilite du profil implicite

#### Tache L1 - Clarifier score et confiance

But:
- rendre la page `/workspace/profile/inference` lisible pour un humain

Livrables:
- score affiche comme une intensite interpretable
- seuils de confiance moins permissifs
- etiquettes UI compréhensibles a la place des enums bruts

#### Tache L2 - Humaniser les diagnostics d inference

But:
- remplacer les raisons et evenements techniques par des formulations produit

Livrables:
- explications de preference lisibles
- etiquettes d evenements dominants en francais
- renommage des indicateurs ambigus comme `Expansions utiles` ou `Evolution du meilleur score`

#### Tache L3 - Documenter les limites de l inference

But:
- expliciter ce que l inference prend en compte, ce qu elle n apprend pas encore, et pourquoi les resultats ne collent pas toujours a 100%

Livrables:
- doc mise a jour
- resume reutilisable pour le support produit et les tests

### Bloc A - Decoupage backend SaaS

#### Tache A1 - Formaliser les facades backend

But:
- introduire une couche `facade` explicite par domaine metier

Facades cibles:
- `auth-facade`
- `profile-facade`
- `search-facade`
- `email-facade`
- `company-targeting-facade`
- `offer-facade`

Livrable:
- routes `app/api/*` limitees au parsing HTTP + delegation vers une facade

#### Tache A2 - Distinguer `application`, `domain` et `infrastructure`

But:
- clarifier ce qui releve de la logique metier, des adaptateurs externes et de la persistence

Structure cible minimale:
- `src/server/application/*`
- `src/server/domain/*`
- `src/server/infrastructure/*`
- `src/server/facades/*`

Note:
- les modules actuels de `src/lib/*` pourront etre deplaces progressivement, sans big bang.

### Bloc B - Auth SaaS

#### Tache B1 - Introduire une abstraction `AuthN` provider

But:
- sortir l implementation email/password et Google OAuth d une logique trop couplee au produit

Providers cibles a moyen terme:
- local auth actuel
- Clerk
- Keycloak
- Supabase Auth

#### Tache B2 - Centraliser `AuthZ`

But:
- avoir une policy unique pour:
  - lecture du profil
  - lecture/suppression des offres
  - brouillons
  - Gmail
  - forwarding
  - futur billing

Livrable:
- un module de policies, pas des checks disperses par route

### Bloc C - Donnees et multi-tenant

#### Tache C1 - Introduire le concept de `workspace` ou `tenant`

Aujourd hui:
- le produit est majoritairement `1 user = 1 espace`

Pour une vraie architecture SaaS:
- il faut expliciter l unite de facturation et d isolation

Option recommandee:
- ajouter un `Workspace`
- rattacher l utilisateur, les offres, les brouillons et la config a ce workspace

#### Tache C2 - Ajouter les `entitlements`

But:
- preparer les limitations par plan

Exemples:
- nombre de recherches par mois
- nombre de brouillons
- Gmail disponible ou non
- synchro mailbox disponible ou non

### Bloc D - Billing

#### Tache D1 - Creer la facade billing

But:
- preparer le projet pour Stripe ou LemonSqueezy sans coupler la logique metier au provider

Sous-taches:
- modele `Plan`
- modele `Subscription`
- modele `BillingEvent`
- facade `billing`
- webhooks provider

#### Tache D2 - Relier billing aux entitlements

But:
- que le plan pilote vraiment les capacites du produit

### Bloc E - Client commun

#### Tache E1 - Creer un package `client-common`

But:
- factoriser les contrats API, types DTO, helpers d appel et validations partagees

Structure cible:
- `packages/client-common`

Contenu:
- types des endpoints
- helpers fetch
- mapping des erreurs
- objets partages UI/client

#### Tache E2 - Rendre l API client-agnostique

But:
- ne pas coder les reponses uniquement pour le web actuel

Objectif:
- qu un client mobile ou desktop puisse consommer les memes facades plus tard

### Bloc F - Services metier et traitements async

#### Tache F1 - Introduire une file de jobs

Cette brique manque sur le schema, mais elle manque aussi dans le produit.

Elle est necessaire pour:
- sync Gmail
- collecte d offres
- parsing portfolio/CV
- enrichment
- scoring lourd

Technos possibles plus tard:
- pg-boss
- trigger.dev
- queue maison basee sur Postgres

#### Tache F2 - Creer un worker applicatif

But:
- sortir les traitements longs du cycle HTTP

### Bloc G - CI/CD et exploitation

#### Tache G1 - Ajouter une vraie CI

Minimum:
- lint
- build
- tests
- prisma validate

#### Tache G2 - Ajouter une vraie CD

Minimum:
- preview deploy
- production deploy
- checks avant promotion

#### Tache G3 - Completer l observabilite

Le projet a deja des logs structures, mais il manque encore:
- dashboards
- alerting
- traces par run
- suivi des erreurs provider

## Taches ajoutees par rapport au schema

Le schema cible est utile, mais il manque quelques briques indispensables pour un vrai SaaS:

1. `Tenant / Workspace`
2. `Entitlements / feature gating`
3. `Queue / worker async`
4. `Audit / billing events / webhooks`
5. `Client common` versionne comme package partage

Ces points doivent etre ajoutes a la liste parce qu ils conditionnent une vraie evolution SaaS.

## Ordre de travail recommande

Ordre recommande pour les prochaines taches:

1. `A1` formaliser les facades backend
2. `A2` separer application/domain/infrastructure
3. `B2` centraliser AuthZ
4. `E1` creer `client-common`
5. `C1` introduire `workspace`
6. `C2` introduire les entitlements
7. `D1` creer la facade billing
8. `D2` relier billing et entitlements
9. `F1` ajouter une queue
10. `F2` ajouter un worker
11. `G1` CI
12. `G2` CD
13. `G3` observabilite complete

## Prochaines etapes ajoutees

### Bloc H - Experience workspace et equipes

#### Tache H1 - Ajouter un vrai selecteur de workspace

But:
- permettre a un utilisateur de voir son workspace actif et, plus tard, de basculer entre plusieurs espaces

Livrable:
- UI workspace switcher
- route serveur pour changer le workspace actif

Statut:
- base implementee: page workspace, switcher du workspace actif et snapshot serveur
- reste a faire: ouverture reelle du multi-workspace et creation d espaces non personnels

#### Tache H2 - Ajouter la gestion d equipe

But:
- sortir du mode `1 user = 1 workspace personnel`

Livrable:
- invitation de membres
- roles `OWNER / ADMIN / MEMBER / BILLING`
- listing des membres par workspace

Statut:
- listing des membres ajoute
- invitations workspace implementees avec lien d acceptation
- edition des roles ajoutee pour owner/admin
- restent a faire les invitations par email automatisees et la suppression de membres

### Bloc I - AuthZ fine grain

#### Tache I1 - Ajouter des policies par ressource

But:
- ne plus se limiter au feature gating global

Livrable:
- policies par role pour offres, brouillons, billing et connecteurs email

#### Tache I2 - Journaliser les actions sensibles

But:
- preparer audit et support client

Livrable:
- audit log pour suppression d offres, envoi Gmail, changement d entitlement et operations billing

### Bloc J - Billing reel

#### Tache J1 - Brancher Stripe ou LemonSqueezy

But:
- remplacer le billing interne placeholder par un vrai provider

Livrable:
- produits/prix externes
- checkout
- webhooks

#### Tache J2 - Ecran abonnement et limites

But:
- rendre visibles le plan courant et les limitations

Livrable:
- page billing workspace
- etat du plan
- capacites restantes

### Bloc K - Async par defaut

#### Tache K1 - Passer la collecte d offres en job asynchrone

But:
- sortir la recherche d offres du cycle HTTP

Livrable:
- lancement de recherche via `AppJob`
- polling ou rafraichissement des runs

#### Tache K2 - Passer Gmail sync en job asynchrone

But:
- eviter les synchronisations lourdes en requete directe

Livrable:
- sync Gmail via worker
- historique des syncs

### Bloc L - Consommation multi-client

#### Tache L1 - Faire consommer `client-common` au web

But:
- verifier que le package partage n est pas decoratif

Livrable:
- types DTO et snapshots importes depuis `packages/client-common`

#### Tache L2 - Preparer un client secondaire

But:
- valider la promesse SaaS multi-client sans lancer un gros chantier

Livrable:
- mini client desktop ou mobile de lecture seule

### Bloc M - Observabilite et support

#### Tache M1 - Dashboards de sante produit

But:
- suivre jobs, erreurs provider, synchronisations Gmail et recherches

Livrable:
- vues d exploitation documentees

#### Tache M2 - Alerting minimal

But:
- remonter rapidement les echecs critiques

Livrable:
- alertes sur erreurs auth, billing, jobs et Gmail

### Bloc N - Hardening du rollout SaaS

#### Tache N1 - Rendre le bootstrap workspace strictement idempotent

But:
- eviter toute collision ou course lors de la premiere resolution du viewer

Livrable:
- creation du workspace personnel robuste aux acces concurrents
- tests de non-regression sur le bootstrap workspace

#### Tache N2 - Finaliser le passage du scope `user` au scope `workspace`

But:
- supprimer les lectures encore principalement user-scoped quand une lecture workspace est plus juste

Livrable:
- audit des routes et services restants
- migration progressive des lectures vers `workspaceId`

#### Tache N3 - Ajouter des checks de configuration provider

But:
- detecter plus vite les erreurs de configuration SaaS en dev et en prod

Livrable:
- checks explicites pour Gmail, billing, worker et providers externes
- erreurs actionnables au demarrage ou sur les routes de setup

Statut:
- snapshot de health checks ajoute pour Google OAuth, Gmail, billing interne et jobs
- reste a faire: checks au demarrage et couverture des futurs providers externes

## Conclusion

Le projet n a pas besoin d etre re-ecrit pour ressembler a ce schema SaaS.

La bonne direction est:
- garder le monolithe Next actuel
- le modulariser en facades et couches internes
- ajouter ensuite `workspace`, `billing`, `client-common` et `jobs async`

Autrement dit:
- l architecture cible est atteignable par evolution incrémentale
- pas par replatforming brutal
