# Protocole de session agent

## Objectif

Donner a tout agent une procedure simple pour reprendre le projet, executer une tache du backlog, laisser des preuves verifiables et cloturer proprement la session.

## 1. Demarrage de session

1. Ouvrir la page de garde Notion du projet.
2. Lire le backlog et prendre la plus petite tache `Prete a faire` non terminee.
3. Verifier les contraintes de session:
   - heure limite eventuelle donnee par l utilisateur
   - acces base de donnees
   - variables d environnement requises (`DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`)
4. Lire uniquement le contexte local utile:
   - `README.md`
   - documents d architecture lies a la tache
   - fichiers du produit concernes
5. Ne pas demarrer une nouvelle tache si la fenetre restante ne permet pas au minimum:
   - implementation
   - validation
   - mise a jour de Notion

## 2. Execution d une tache

1. Comprendre la definition terminee et les dependances depuis la fiche backlog.
2. Limiter le changement au plus petit scope qui satisfait la tache.
3. Reutiliser les logiques deja en place avant d ajouter une nouvelle API, page ou abstraction.
4. Si la tache touche l UI:
   - verifier la navigation
   - verifier les etats de boutons
   - verifier les messages d erreur et de succes
5. Si la tache touche la persistance ou une API:
   - verifier le flux runtime reel
   - confirmer la relecture des donnees apres ecriture

## 3. Validation minimale obligatoire

Selon le type de tache:

- code statique:
  - `npm run lint`
  - `npm run build`
- tache runtime:
  - lancer l app localement
  - tester le chemin principal en HTTP reel
  - verifier les codes de retour et les elements visibles importants
- tache base de donnees:
  - verifier la persistance
  - verifier la relecture des donnees exportees ou rechargees

Important:

- ne pas laisser `next dev` tourner en fin de session
- sur Windows, stopper les process Node avant un nouveau build si besoin
- eviter les faux positifs: une tache n est pas terminee tant que la preuve runtime ou build n existe pas

## 4. Mise a jour de Notion

Pour chaque tache terminee:

1. Passer `Statut` a `Done`
2. Cocher `Terminee`
3. Renseigner `Resultat / preuve` avec:
   - ce qui a ete implemente
   - la preuve de validation la plus concrete
   - l ecran ou l endpoint verifies

Si une tache est bloquee:

1. laisser `Terminee` a faux
2. decrire le blocage exact
3. noter l action suivante necessaire

## 5. Cloture de session

1. Verifier qu aucune instance locale de dev server ne reste active.
2. Lister les fichiers modifies et l impact produit.
3. Resumer les validations executees.
4. Identifier la prochaine tache prete, sans l entamer si la limite horaire est proche.
5. Produire une synthese finale claire pour l utilisateur:
   - taches finies
   - modifications apportees
   - validations
   - point d arret reel

## 6. Regles de decision

- Si une tache peut etre satisfaite par une extension d un flux existant, preferer cette voie.
- Si une tache ready suivante ouvre un chantier trop large, s arreter proprement plutot que simuler un avancement.
- Si la definition terminee est deja couverte par l implementation existante, produire la preuve, ajuster l artefact manquant, puis cloturer.
