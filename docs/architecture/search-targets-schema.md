# Schema `search_targets`

## Objectif

Formaliser la partie recherche editable depuis l interface web:

- postes cibles
- mots cles de recherche
- localisations preferees
- domaines prioritaires

## Format retenu

```json
{
  "version": 1,
  "targets": [
    {
      "title": "Backend Engineer Intern",
      "employmentTypes": ["INTERNSHIP"],
      "priority": 90,
      "isActive": true
    }
  ],
  "keywords": ["TypeScript", "automation"],
  "preferredLocations": [
    {
      "label": "Paris",
      "countryCode": "FR",
      "isRemote": false,
      "isHybrid": true,
      "priority": 90
    }
  ],
  "preferredDomains": [
    {
      "label": "Developer Tools",
      "rationale": "Alignement fort avec le profil technique."
    }
  ]
}
```

## Champs

- `targets[]`: cibles metier avec contrat, priorite et activation
- `keywords[]`: mots cles de recherche transverses
- `preferredLocations[]`: zones geographiques ou remote/hybride
- `preferredDomains[]`: domaines a prioriser dans la recherche et le bootstrap

## Contraintes

- `title` et `label` requis, propres et dedupes cote application
- `priority` entre 0 et 100
- `employmentTypes` borne a 4 valeurs par cible
- `keywords` restent modifiables librement depuis l interface

## Mapping base

- `targets[]` -> `SearchTarget[]`
- `preferredLocations[]` -> `SearchLocation[]`
- `preferredDomains[]` -> `SearchDomain[]`
- `keywords[]` -> `UserProfile.constraints.searchKeywords`

## Fichiers relies

- `apps/web/src/lib/config/search-targets.ts`
- `apps/web/src/lib/profile/schema.ts`
- `apps/web/src/app/workspace/preferences/_components/preferences-form.tsx`
