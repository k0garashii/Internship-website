# Plan de requetes de recherche

## Objectif

Transformer les domaines valides, les roles cibles, les localisations et les mots cles en une liste de requetes directement reutilisable par le futur moteur de collecte.

## Entree

- `personal_profile`
- `search_targets`

## Sortie

Route exposee:

- `GET /api/search/plan`

Structure retournee:

```json
{
  "generatedAt": "2026-03-19T11:00:00.000Z",
  "summary": "Plan genere a partir de 2 role(s), 2 domaine(s) et 2 localisation(s).",
  "queries": [
    {
      "id": "backend-engineer-intern-developer-tools-paris",
      "label": "Backend Engineer Intern | Developer Tools | Paris",
      "queryText": "Backend Engineer Intern Developer Tools Paris TypeScript Prisma",
      "targetRole": "Backend Engineer Intern",
      "domain": "Developer Tools",
      "location": "Paris",
      "keywords": ["TypeScript", "Prisma"],
      "explanation": "Requete composee a partir du role cible, du domaine et de la localisation."
    }
  ]
}
```

## Regles

- prioriser les roles explicites du profil utilisateur
- utiliser les domaines valides par l utilisateur
- reutiliser les localisations preferees
- injecter un sous-ensemble de mots cles concrets pour rendre la requete exploitable
- limiter la combinatoire pour produire un plan court et lisible

## Fichiers relies

- `apps/web/src/lib/search/query-plan.ts`
- `apps/web/src/app/api/search/plan/route.ts`
- `docs/architecture/domain-bootstrap.md`
