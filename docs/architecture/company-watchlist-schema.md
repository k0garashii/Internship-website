# Schema `company_watchlist`

## Objectif

Definir un format explicite et testable pour le fichier historique `company_watchlist`,
en cohérence avec le modele multi-utilisateur deja present en base.

Ce fichier reste une source complementaire:

- utile pour importer une liste d'entreprises prioritaires
- utile pour exporter une vue partageable ou editable hors application
- non suffisant a lui seul comme source de verite produit

## Format retenu

```json
{
  "version": 1,
  "items": [
    {
      "companyName": "Alan",
      "websiteUrl": "https://alan.com",
      "careerPageUrl": "https://alan.com/careers",
      "notes": "Produit B2B SaaS europeen",
      "priority": 80,
      "isActive": true
    }
  ]
}
```

## Champs

### Niveau fichier

- `version`: entier fixe a `1`
- `items`: tableau de 0 a 500 entreprises

### Niveau item

- `companyName`: requis, 2 a 160 caracteres
- `websiteUrl`: optionnel, URL valide
- `careerPageUrl`: optionnel, URL valide
- `notes`: optionnel, jusqu'a 1000 caracteres
- `priority`: entier entre 0 et 100, par defaut `50`
- `isActive`: booleen, par defaut `true`

## Contraintes

- les doublons sont interdits apres normalisation du nom d'entreprise
- la normalisation retire accents, casse et ponctuation pour produire `normalizedName`
- `priority` permet de classer les entreprises dans l'ordre de veille ou d'import
- `websiteUrl` et `careerPageUrl` restent optionnels pour ne pas bloquer une saisie rapide

## Mapping base de donnees

Chaque item valide peut etre projete dans `CompanyWatchlistItem`:

- `companyName` -> `companyName`
- `normalizedName` -> `normalizedName`
- `websiteUrl` -> `websiteUrl`
- `careerPageUrl` -> `careerPageUrl`
- `notes` -> `notes`
- `priority` -> `priority`
- `isActive` -> `isActive`

Le `userId` n'appartient pas au fichier historique. Il est injecte lors de l'import
dans le contexte du compte connecte.

## Fichiers relies

- `apps/web/prisma/schema.prisma`
- `apps/web/src/lib/config/company-watchlist.ts`
- `docs/architecture/data-model.md`
