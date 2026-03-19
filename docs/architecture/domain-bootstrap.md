# Bootstrap de domaines et prompt Gemini

## Objectif

Produire une premiere base editable de:

- domaines prioritaires
- roles cibles
- localisations
- mots cles

a partir du `personal_profile` et de `search_targets`.

## Prompt retenu

Le prompt construit dans `apps/web/src/lib/domains/bootstrap.ts` demande a Gemini de:

- partir du profil utilisateur et de ses preferences de recherche
- proposer une base initiale exploitable pour la recherche d offres
- rester concret et eviter les domaines trop generiques
- retourner une structure JSON avec `summary`, `domains`, `targetRoles`, `locations`, `keywords`

## Sortie attendue

```json
{
  "summary": "Base initiale coherente pour amorcer la recherche.",
  "domains": [
    {
      "label": "Developer Tools",
      "rationale": "Le profil backend et automatisation s aligne avec ce domaine."
    }
  ],
  "targetRoles": ["Backend Engineer Intern"],
  "locations": ["Paris", "Remote"],
  "keywords": ["TypeScript", "automation", "Node.js"]
}
```

## Strategie d execution

- si une cle Gemini est configuree, l application appelle `generateContent`
- l appel utilise un schema JSON de sortie pour obtenir une structure predictable
- si aucune cle n est disponible, ou si l appel externe echoue, un fallback local deterministe genere une premiere base a partir des competences et preferences existantes

## Pourquoi ce fallback

- ne pas bloquer l utilisateur en environnement local
- garder une fonctionnalite immediate pour le check produit
- preparer une transition simple vers Gemini sans changer l interface

## Fichiers relies

- `apps/web/src/lib/domains/bootstrap.ts`
- `apps/web/src/app/api/profile/domain-bootstrap/route.ts`
- `docs/architecture/personal-profile-schema.md`
- `docs/architecture/search-targets-schema.md`
