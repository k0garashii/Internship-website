# Forwarding Email Dedie

## Objectif

La tache `249` connecte une premiere source email exploitable sans credentials OAuth externes: un mecanisme de forwarding vers une boite ou un provider inbound dedie, relie a un endpoint serveur protege par secret.

## Ce Qui Est Implemente

- un modele de connexion email `FORWARDING` par utilisateur
- un secret de webhook genere cote serveur
- un identifiant de forwarding unique par utilisateur
- un endpoint d intake `POST /api/email/forwarding/intake`
- une page `/workspace/email` pour provisionner et visualiser les messages recus

## Principe

1. l utilisateur provisionne son forwarding depuis l interface
2. le systeme genere:
   - un identifiant de forwarding
   - une URL d intake
   - un secret d authentification
3. un provider inbound ou un outil d automatisation pousse les emails entrants vers l intake
4. le pipeline stocke:
   - expediteur
   - destinataire
   - sujet
   - extrait
   - lien detecte
   - date
   - signal initial

## Contrat D Intake

Le MVP accepte un JSON normalise de type:

```json
{
  "envelope": {
    "to": "jobs-abc123@forwarding.example.com",
    "from": "alerts@linkedin.com",
    "messageId": "<msg-123@example.com>",
    "receivedAt": "2026-03-19T14:00:00.000Z"
  },
  "message": {
    "subject": "New internship matches",
    "text": "A new role may match your profile: https://company.example/jobs/123",
    "snippet": "A new role may match your profile"
  },
  "metadata": {
    "provider": "cloudmailin"
  }
}
```

Le secret de forwarding doit etre passe dans l en-tete `x-forwarding-secret`.

## Donnees Stockees

Le pipeline ne conserve pas le mail brut complet par defaut. Il stocke seulement:

- `fromEmail`
- `fromName`
- `toEmail`
- `subject`
- `bodyPreview`
- `snippet`
- `canonicalUrl`
- `signal`
- `receivedAt`

## Signaux Initiaux

Une classification heuristique minimale est ajoutee a la reception:

- `JOB_ALERT`
- `CAREER_SITE_DIGEST`
- `RECRUITER_OUTREACH`
- `SCHOOL_CAREER_DIGEST`
- `APPLICATION_UPDATE`
- `UNKNOWN`

## Limites Volontaires

- aucun connecteur Gmail ou Outlook OAuth a ce stade
- aucun traitement des pieces jointes
- pas encore de synchronisation planifiee recurrente
- la persistance finale dans `JobOffer` reste renvoyee a la tache `260`

## Suite Preparee

- `252`: parser les emails en opportunites structurees
- `260`: persister les offres et opportunites structurees
