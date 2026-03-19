# Strategie D Ingestion Des Emails D Offres

## Objectif

La tache `248` definit comment recuperer des opportunites depuis les emails de l utilisateur sans diluer la strategie principale du projet. Les emails ne remplacent pas la collecte web: ils ajoutent de la fraicheur, des signaux de recruteurs et des offres qui ne remontent pas toujours sur les job boards publics.

## Place Dans Le Pipeline

Le pipeline cible devient:

1. profil utilisateur et domaines valides
2. entreprises cibles
3. pages carrieres et ATS publics
4. collecte web structuree
5. emails d alertes et emails recruteurs
6. normalisation, deduplication puis scoring

Les emails sont donc un canal complementaire, pas le point de depart du systeme.

## Sources A Supporter

Ordre recommande:

1. Gmail
2. Outlook / Microsoft 365
3. forwarding vers une boite dediee

Pourquoi:

- Gmail et Outlook couvrent la majorite des cas grand public, etudiants et entreprise.
- Le forwarding offre un chemin sans OAuth pour les utilisateurs qui veulent garder leur boite principale fermee.

## Signaux Emails A Cibler

- `job_alert`: alertes automatisees de job boards et ATS
- `career_site_digest`: digest provenant directement de pages carrieres d entreprises
- `recruiter_outreach`: prise de contact manuelle d un recruteur ou d une RH
- `school_career_digest`: emails universite, ecole, forum, partenaire
- `application_update`: suivi d une candidature deja lancee

## Permissions Et Connexion

### Gmail

- scope minimum: `gmail.readonly`
- ne pas demander `gmail.modify`
- ne pas demander `gmail.send`
- filtrer idealement un label dedie du type `jobs` ou `career-alerts`

### Outlook / Microsoft 365

- scope minimum: `Mail.Read`
- `offline_access` autorise une sync reguliere
- `User.Read` peut etre utile pour l identification du compte
- ne pas demander `Mail.Send` ni `Mail.ReadWrite`

### Forwarding

- aucune permission OAuth
- l utilisateur transfere ses alertes vers une adresse dediee du projet
- l application lit uniquement cette boite dediee

## Regles De Securite Et De Produit

- lecture seule par defaut
- aucune suppression ou archivage automatique
- aucune emission d email
- pas de conservation du mail brut par defaut
- pas de telechargement automatique des pieces jointes au MVP
- revocation simple du connecteur obligatoire
- limiter le scan aux labels, dossiers, categories ou boites dediees aux alertes emploi

## Ce Qui Sera Parse

En premiere intention, il faut extraire:

- expediteur
- sujet
- date
- extrait texte court
- URL d offre
- entreprise si detectable
- type de signal
- score de confiance du parsing

Le mail complet n est pas la sortie produit. La sortie produit est une opportunite structuree exploitable par les etapes `250`, `260`, `270`, `280` et `290`.

## Deduplication

Pour eviter le bruit, il faudra dedupliquer par:

- `message-id`
- expediteur
- sujet normalise
- URL canonique de l offre
- entreprise + titre si le lien n est pas exploitable

## Limites Volontaires

- pas de support IMAP generique au MVP
- pas de scan complet et indefini de la boite mail
- pas d analyse de toutes les pieces jointes
- pas d action automatique de reponse ou de candidature

## Sortie Technique Introduite

La strategie est materialisee dans:

- `apps/web/src/lib/email/strategy.ts`
- `GET /api/email/ingestion-strategy`

Cette base prepare:

- `249`: connecter une vraie source email ou un forwarding
- `252`: parser les emails en opportunites structurees
