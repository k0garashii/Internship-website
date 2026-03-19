# Schema `personal_profile`

## Objectif

Definir un format stable pour le coeur du profil utilisateur, en cohérence avec:

- le formulaire web
- `User` + `UserProfile` + `ProfileSkill`
- les futures integrations Gemini et import/export

## Format retenu

```json
{
  "version": 1,
  "profile": {
    "fullName": "Sasha Martin",
    "headline": "Etudiant ingenieur backend a la recherche d un stage",
    "summary": "Je cible des equipes produit avec une forte composante TypeScript et automatisation.",
    "school": "EPITA",
    "degree": "Cycle ingenieur",
    "graduationYear": 2027,
    "city": "Paris",
    "countryCode": "FR",
    "remotePreference": "HYBRID",
    "experienceLevel": "INTERN",
    "availabilityDate": "2026-09-01",
    "links": {
      "linkedinUrl": "https://linkedin.com/in/sasha-martin",
      "githubUrl": "https://github.com/sasha-martin",
      "portfolioUrl": null,
      "resumeUrl": null
    },
    "skills": ["TypeScript", "Node.js", "Prisma"],
    "constraints": {
      "visaNeedsSponsorship": false,
      "salaryExpectationMin": 1200,
      "salaryExpectationMax": 1800,
      "preferencesNotes": "Scope europe et equipe produit."
    }
  }
}
```

## Champs

- `fullName`: nom du candidat
- `headline`: positionnement court
- `summary`: resume libre
- `school`, `degree`, `graduationYear`: contexte academique
- `city`, `countryCode`: localisation principale
- `remotePreference`: modalite de travail preferee
- `experienceLevel`: niveau vise
- `availabilityDate`: disponibilite au format `YYYY-MM-DD`
- `links`: presence professionnelle
- `skills`: competences clefs normalisees au chargement
- `constraints`: sponsor visa, attentes salariales, preferences libres

## Contraintes

- `graduationYear` entre 2020 et 2100
- URLs valides ou `null`
- `skills` non vides et dedupees cote application
- `salaryExpectationMin` et `salaryExpectationMax` restent optionnels

## Mapping base

- `fullName` -> `User.fullName`
- corps du profil -> `UserProfile`
- `skills[]` -> `ProfileSkill[]`
- `constraints.*` -> `UserProfile.constraints`

## Fichiers relies

- `apps/web/src/lib/config/personal-profile.ts`
- `apps/web/src/lib/profile/schema.ts`
- `apps/web/prisma/schema.prisma`
