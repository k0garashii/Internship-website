# InternshipScrapper

Socle initial du projet d'automatisation de recherche de stage et d'emploi.

## Stack retenue

- Frontend: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4
- Backend: Route Handlers et logique serveur Next.js dans la meme application web
- Donnees: PostgreSQL comme cible de persistance, Prisma 6 retenu pour les taches base/auth a venir
- Validation: schemas TypeScript partages, avec Zod prevu pour les formulaires et les APIs

## Pourquoi ce choix

- Une seule application debloque rapidement les taches d'authentification, de profil utilisateur et d'API interne.
- Le pattern BFF de Next.js suffit pour les endpoints du produit sans introduire trop tot un service backend separe.
- La structure `apps/web` laisse une porte propre pour ajouter plus tard un worker de collecte ou des packages partages si le scraping grossit.
- La version de Next est epinglee sur la serie 15 pour rester compatible avec le Node local actuel (`20.13.1`).

## Structure actuelle

- `apps/web`: application web full-stack
- `docs/architecture/stack.md`: decision technique et implications pour le backlog
- `docs/architecture/data-model.md`: modele de donnees multi-utilisateur cible
- `docs/architecture/data-isolation.md`: regles d'isolation des donnees par utilisateur
- `docs/architecture/profile-fields.md`: noyau des champs profil utiles a la recherche
- `docs/architecture/profile-api.md`: contrat API stable pour lire et mettre a jour le profil courant
- `docs/architecture/company-targeting.md`: passage du profil vers une liste d entreprises cibles
- `docs/architecture/career-source-discovery.md`: detection automatique des pages carrieres et ATS a partir des entreprises cibles
- `docs/architecture/email-ingestion-strategy.md`: perimetre, permissions et limites pour ingerer des annonces depuis les emails
- `docs/architecture/email-forwarding-ingestion.md`: provisioning d un forwarding dedie et contrat d intake serveur
- `docs/architecture/offer-normalization.md`: format interne commun pour les opportunites web et email
- `docs/architecture/offer-sources.md`: priorisation des plateformes et sources d offres
- `docs/architecture/offer-discovery.md`: premiere collecte internet reelle et limites du MVP
- `docs/architecture/search-query-plan.md`: transformation du profil et des preferences en plan de requetes
- `docs/architecture/search-source-strategy.md`: strategie de recherche selon le type de source
- `docs/process/agent-session-protocol.md`: protocole de reprise, execution et cloture des sessions agent
- `docs/process/operational-agents.md`: registre final des agents operatoires et de leurs responsabilites

## Commandes

```bash
npm run dev
npm run lint
npm run build
```

## Etat du produit

- Authentification par email et mot de passe avec session HTTP-only
- Protection des routes applicatives et deconnexion
- Onboarding utilisateur avec sauvegarde et rechargement du profil en base
- API stable `GET/PATCH /api/profile` pour relire et mettre a jour le profil utilisateur
- API `GET /api/email/ingestion-strategy` pour exposer la strategie email cible et les permissions minimales
- API `GET/POST /api/email/forwarding` pour provisionner un forwarding dedie et lister les messages recus
- API `POST /api/email/forwarding/intake` pour ingerer les emails entrants via secret de webhook
- API `GET/POST /api/profile/company-targets` pour suggerer des entreprises cibles a partir du profil
- API `POST /api/profile/company-targets/discovery` pour detecter les pages carrieres et ATS publics des entreprises cibles
- API `GET /api/search/plan` pour generer un plan de requetes a partir du profil et des preferences
- API `GET/POST /api/search/discovery` pour lancer une premiere collecte internet d offres via Welcome to the Jungle
- La reponse de `GET/POST /api/search/discovery` expose maintenant aussi `normalizedOffers` en format commun
- Ecran `/workspace/search` pour generer des entreprises cibles, enrichir ces cibles avec des pages carrieres ou ATS, lancer la collecte publique et previsualiser les offres dedupliquees
- Ecran `/workspace/email` pour provisionner un forwarding dedie, visualiser les emails recus et preparer le parsing des opportunites
