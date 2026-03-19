# Agents operatoires du projet

## Objectif

Figer la liste des agents operatoires utiles au projet et leur role principal afin de garder un registre stable entre la backlog, Notion et les futures sessions.

## Registre

### Orchestrateur projet

- role: arbitre l ordre d execution, les dependances et les limites de session
- intervient quand: plusieurs taches sont prêtes ou qu un arbitrage de priorite est necessaire
- livrable attendu: plan court, ordre de travail, point d arret propre

### Architecte configuration

- role: structure les formats `company_watchlist`, `personal_profile`, `search_targets`
- intervient quand: un schema ou une regle de source de verite doit etre defini
- livrable attendu: schema, conventions, mapping DB ou export/import

### Responsable auth et securite

- role: gere comptes, sessions, protection des routes et hygiene securite
- intervient quand: l authentification ou l isolation multi-utilisateur change
- livrable attendu: code auth, regles de protection, preuves runtime

### Ingenieur backend et donnees

- role: implemente APIs, persistance, projections et contrats serveur
- intervient quand: une route API, un modele Prisma ou une logique de sauvegarde doit etre ajoute
- livrable attendu: endpoint, validation, persistance, tests de lecture/ecriture

### Ingenieur frontend et UX

- role: construit les parcours, ecrans, feedbacks et navigation
- intervient quand: une page, un formulaire ou une amelioration d usage est necessaire
- livrable attendu: ecran utilisable, etats de boutons, verification visuelle ou runtime

### Specialiste domaines et Gemini

- role: gere le bootstrap de domaines, l usage de Gemini et les transformations explicables
- intervient quand: il faut generer, valider ou exploiter la base initiale de domaines
- livrable attendu: prompt, logique de generation, fallback, preuves Gemini ou fallback

### Collecteur sources et offres

- role: definit puis implemente la collecte des offres par source
- intervient quand: une plateforme, une recherche ou une normalisation de collecte doit etre ajoutee
- livrable attendu: strategie par source, pipeline de collecte, metadonnees source

### Analyste matching et scoring

- role: transforme profil et offres en score interpretable
- intervient quand: la pertinence d une offre doit etre calculee ou classee
- livrable attendu: formule, explication, classement ou moteur de matching

### Personnalisateur email

- role: prepare le contexte et la generation des brouillons de candidature
- intervient quand: une offre retenue doit produire un email personnalise
- livrable attendu: contexte, prompt, brouillon, statut du draft

### Qualite et tests

- role: verifie la stabilite technique et la qualite d execution
- intervient quand: un chantier touche plusieurs couches ou introduit un risque de regression
- livrable attendu: lint, build, smoke tests, findings ou feu vert

### Documentation et reporting

- role: maintient les docs versionnees et les resumes de session
- intervient quand: une decision, un contrat ou une strategie doit etre memorisee
- livrable attendu: document local, synthese, references croisées

### Mainteneur Notion

- role: tient la backlog et les pages de reference en phase avec l execution
- intervient quand: une tache change de statut, qu un protocole est formalise ou qu un hub doit etre mis a jour
- livrable attendu: statut Notion, preuve, page enfant ou registre

### Architecte produit et integration

- role: garantit la coherence entre flux produit, APIs, UI et roadmap
- intervient quand: une tache traverse plusieurs domaines ou qu une decision produit/technique doit etre alignee
- livrable attendu: arbitrage coherent, articulation entre couches, reduction des doublons

## Regles d usage

1. Une tache peut avoir un agent principal, mais plusieurs agents peuvent contribuer.
2. Le nom de l agent sert d intention de travail, pas de silo strict.
3. Si un nouvel agent est introduit, il doit couvrir un besoin critique non deja adresse par la liste actuelle.
