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
- `docs/architecture/email-opportunity-parsing.md`: projection des emails entrants vers le format commun d opportunite
- `docs/architecture/email-personalization-prompt.md`: prompt systeme et prompt utilisateur pour la generation de brouillons d email
- `docs/architecture/email-draft-generation.md`: route, fallback et persistance des premiers brouillons de candidature
- `docs/architecture/email-draft-review.md`: ecran dedie pour relire, editer et copier les brouillons
- `docs/architecture/observability.md`: conventions de logs, evenements traces et lien avec les runs de recherche
- `docs/architecture/offer-normalization.md`: format interne commun pour les opportunites web et email
- `docs/architecture/offer-sources.md`: priorisation des plateformes et sources d offres
- `docs/architecture/offer-discovery.md`: premiere collecte internet reelle et limites du MVP
- `docs/architecture/offer-persistence.md`: persistance des `SearchRun`, `JobOffer` et `SearchRunOffer`
- `docs/architecture/offer-deduplication.md`: fusion des doublons exacts ou proches cote backend
- `docs/architecture/offer-scoring.md`: formule initiale de scoring et poids utilises avant le matching complet
- `docs/architecture/offer-matching.md`: moteur interpretable de matching profil-offre
- `docs/architecture/offer-ranking.md`: ordre de tri final des offres dedupliquees
- `docs/architecture/offer-listing.md`: API et affichage des offres persistees avec leur etat courant
- `docs/architecture/offer-detail-page.md`: fiche detail d une offre persistée avec historique, feedback et brouillons
- `docs/architecture/offer-feedback.md`: feedback explicite par offre et persistance associee
- `docs/architecture/offer-gemini-context.md`: contrat minimal profil + offre + signaux pour les futures generations Gemini
- `docs/architecture/deployment.md`: procedure GitHub, Vercel et Supabase pour le deploiement initial
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
- API `POST /api/email/drafts/generate` pour generer puis persister un brouillon de candidature contextualise pour une offre
- API `GET /api/email/drafts` pour lister les brouillons de l utilisateur
- API `PATCH /api/email/drafts/[draftId]` pour relire et corriger un brouillon avant usage externe
- Les emails entrants sont maintenant classes en `PARSED` ou `IGNORED` et projetes en opportunites structurees quand le signal est exploitable
- API `GET/POST /api/profile/company-targets` pour suggerer des entreprises cibles a partir du profil
- API `POST /api/profile/company-targets/discovery` pour detecter les pages carrieres et ATS publics des entreprises cibles
- API `GET /api/search/plan` pour generer un plan de requetes a partir du profil et des preferences
- API `GET/POST /api/search/discovery` pour lancer une premiere collecte internet d offres via Welcome to the Jungle
- API `GET /api/search/history` pour lister les runs deja executes et leurs meilleurs resultats
- API `GET /api/search/offers` pour lister les offres persistees et leur etat courant
- API `GET /api/search/offers/[offerId]` pour charger la fiche detail d une offre persistée
- API `POST /api/search/offers/[offerId]/feedback` pour enregistrer un feedback explicite par offre
- La reponse de `GET/POST /api/search/discovery` expose maintenant aussi `normalizedOffers` en format commun
- La reponse de `GET/POST /api/search/discovery` persiste maintenant aussi un `SearchRun` et des `JobOffer`, puis renvoie un resume `persistence`
- Chaque offre de `GET/POST /api/search/discovery` expose maintenant aussi un bloc `matching` interpretable, et le tri final suit `matching.score` puis la priorite utilisateur
- Un contrat serveur formalise maintenant les donnees minimales transmises a Gemini pour une offre retenue avant generation d email
- Un builder de prompt systeme / utilisateur formalise maintenant la future generation de brouillons d email a partir de ce contexte
- Chaque offre persistee peut maintenant declencher une premiere generation de brouillon, avec persistance en `EmailDraft` et fallback deterministe si Gemini echoue
- Chaque offre persistee peut aussi etre marquee pertinente, a revoir ou non pertinente, avec note optionnelle
- Les routes critiques emettent maintenant aussi des logs structures de succes et d erreur pour faciliter le diagnostic runtime
- Ecran `/workspace/search` pour generer des entreprises cibles, enrichir ces cibles avec des pages carrieres ou ATS, lancer la collecte publique, previsualiser les offres dedupliquees, matchees et classees, puis afficher les offres deja persistees avec leur statut
- Fiche `/workspace/search/offers/[offerId]` pour approfondir une opportunite persistée, revoir son matching, ses runs, le feedback et les brouillons associes
- L ecran `/workspace/search` affiche aussi l historique recent des recherches executees
- Ecran `/workspace/email` pour provisionner un forwarding dedie, visualiser les emails recus et controler leur projection en opportunites structurees
- Ecran `/workspace/drafts` pour relire, modifier, sauvegarder et copier les brouillons generes
