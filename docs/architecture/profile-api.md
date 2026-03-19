# API profil utilisateur

## Objectif

Fournir un contrat backend stable pour lire et mettre a jour le profil courant sans dependre directement des ecrans d onboarding.

## Route

- `GET /api/profile`
- `PATCH /api/profile`

## Authentification

- Session HTTP-only obligatoire
- `401` si aucune session active
- `404` si l utilisateur courant n existe plus

## GET

Retourne la projection frontend du profil courant, reutilisable par tous les ecrans.

Structure retournee:

```json
{
  "fullName": "Sasha Martin",
  "email": "sasha@example.com",
  "domains": [
    {
      "id": "cuid",
      "label": "Developer Tools",
      "rationale": "Fort alignement backend",
      "source": "GEMINI",
      "isValidated": true
    }
  ],
  "profile": {
    "headline": "Backend engineer intern",
    "summary": "...",
    "skills": "TypeScript, Prisma",
    "targetRoles": "Backend Engineer Intern",
    "searchKeywords": "typescript, prisma",
    "preferredLocations": "Paris",
    "preferredDomains": "Developer Tools"
  }
}
```

## PATCH

Accepte le payload du formulaire profil/preferences deja valide par `profileOnboardingSchema`, avec en plus `domainSelections` pour les domaines structures.

Effets:

- met a jour `User` et `UserProfile`
- remplace `SearchTarget`, `SearchLocation` et `SearchDomain`
- ne persiste que les domaines explicitement valides
- conserve `source` et `rationale` pour les domaines retenus

## Pourquoi une route separee

- evite de coupler le reste du frontend au chemin historique `/api/profile/onboarding`
- prepare les futurs ecrans de gestion de profil et les integrations externes
- garde une seule logique de validation/persistance via `saveProfileOnboarding`
