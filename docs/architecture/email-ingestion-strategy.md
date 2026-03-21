# Strategie D Ingestion Email Et Suivi Des Reponses

## Objectif

Le produit evolue d un MVP centre sur le forwarding vers une cible `Gmail-first`:

1. connecter la boite Gmail de l utilisateur en lecture ciblee
2. synchroniser les messages utiles a l emploi et aux candidatures
3. detecter les reponses de candidature meme si le mail initial est parti hors application
4. ajouter ensuite la creation de brouillons Gmail puis l envoi explicite depuis l application

Le forwarding dedie reste supporte comme fallback pour les utilisateurs qui refusent OAuth ou qui veulent isoler strictement leurs alertes.

## Pourquoi Cette Direction

Le besoin principal n est pas seulement de lire des alertes emploi. Il est aussi de suivre ce qui se passe apres candidature:

- reponses de recruteurs
- demandes d entretien
- refus
- relances
- mises a jour ATS

Si le produit ne regarde que les emails envoyes depuis l application, il rate tous les cas ou l utilisateur a candidaté depuis Gmail, LinkedIn, un site carriere ou un autre client mail. La bonne source de verite devient donc la boite mail synchronisee, pas les seuls envois applicatifs.

## Pipeline Cible

1. profil utilisateur et preferences
2. collecte web et offres persistées
3. connexion Gmail optionnelle
4. synchronisation lecture seule ciblee par label ou requete
5. stockage de messages synchronises entrant et sortant
6. inference des conversations et reponses de candidature
7. brouillons Gmail dans la boite de l utilisateur
8. envoi Gmail explicite avec validation humaine

## Portee Produit

### Phase 1

- connexion Google + ajout progressif des scopes Gmail
- lecture Gmail en lecture seule
- synchronisation ciblee des messages utiles
- suivi des reponses de candidature

Etat courant:

- routes OAuth Google et callback en place
- connexion Gmail persistÃ©e en base
- synchronisation Gmail manuelle via requete ciblee
- inference de reponses par thread Gmail et rapprochement avec les offres

### Phase 2

- creation de brouillons Gmail depuis l application
- lien entre offre retenue et brouillon Gmail

### Phase 3

- envoi Gmail depuis l application
- journalisation minimale de l action et mise a jour du suivi

## Principes De Permission

### Lecture

- scope principal: `https://www.googleapis.com/auth/gmail.readonly`
- lecture ciblee par label ou requete Gmail
- pas de `gmail.modify` au MVP
- pas de suppression, archivage ou marquage automatique

### Brouillons

- scope additionnel: `https://www.googleapis.com/auth/gmail.compose`
- demande uniquement quand l utilisateur active la creation de brouillons Gmail

### Envoi

- scope additionnel: `https://www.googleapis.com/auth/gmail.send`
- demande uniquement quand l utilisateur veut envoyer depuis l application
- validation humaine obligatoire

## Principe D Inference Des Reponses

Le suivi des candidatures ne doit pas dependre d un identifiant d email emis par l application.

Le moteur doit donc reconstruire les conversations depuis la boite synchronisee a partir de:

- `threadId` Gmail quand il existe
- sujet normalise
- participants
- dates
- URL detectees
- entreprise ou ATS detecte
- signaux de langage dans le sujet, le snippet et le corps court

Cette approche couvre:

- candidature envoyee depuis Gmail
- candidature envoyee depuis un ATS externe
- reponse recue dans Gmail sans passage par l application

## Donnees A Stocker

Pour chaque connecteur Gmail:

- compte OAuth relie
- adresse mail du compte
- curseur de synchronisation
- label ou requete ciblee
- date du dernier sync
- dernier message d erreur de sync

Pour chaque message synchronise:

- identifiant provider
- thread provider
- direction `INBOUND` ou `OUTBOUND`
- expediteur
- destinataires
- sujet normalise
- extrait
- URL canonique detectee
- signal metier
- dates utiles

Le mail brut complet ne doit pas etre la sortie produit principale.

## Forwarding

Le forwarding dedie reste utile pour:

- les utilisateurs qui ne veulent pas connecter Gmail
- des alertes transferees volontairement
- des phases de test ou de securisation

Mais il ne doit plus porter seul la vision produit de la page email.

Etat courant:

- forwarding dedie toujours provisionnable
- Gmail passe devant dans la page `workspace/email`
- le forwarding devient un fallback pour les alertes et cas sans OAuth

## Taches Backlog Associees

- `710`: redefinir la strategie email autour de Gmail en lecture et suivi de candidatures
- `720`: modeliser la connexion Gmail, les curseurs de sync et les messages de boite en base
- `730`: implementer la connexion Google et l ajout incremental des scopes Gmail
- `740`: implementer la lecture Gmail ciblee par label, requete et synchronisation incrementale
- `750`: detecter les reponses de candidatures depuis la boite Gmail sans dependre des envois de l application
- `760`: creer la page utilisateur pour connecter Gmail et suivre les reponses de candidature
- `770`: creer les brouillons Gmail depuis l application a partir des offres retenues
- `780`: permettre l envoi Gmail depuis l application avec validation humaine
- `790`: documenter les scopes Gmail, la verification Google et les regles de revocation
- `795`: valider end-to-end la connexion Gmail, la synchronisation et le suivi des reponses sur comptes de test
