# Decision de stack

## Decision

Le projet part sur une application web full-stack avec Next.js App Router comme socle principal.

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- Backend: Route Handlers et composants serveur Next.js sur runtime Node.js
- Base de donnees cible: PostgreSQL
- ORM retenu pour les prochaines taches: Prisma 6
- Validation prevue: Zod pour les entrees formulaire et les contrats API
- Package manager courant: npm

## Justification

Cette decision minimise le temps de mise en place tout en couvrant directement les prochaines taches du backlog:

1. Authentification et sessions sans dupliquer la logique entre frontend et backend.
2. Onboarding profil et preferences dans la meme application.
3. APIs internes pour lire, modifier et lancer les recherches via des Route Handlers.
4. Evolution possible vers un `apps/worker` si la collecte d'offres devient plus lourde ou plus asynchrone.

## Contraintes prises en compte

- Le poste local tourne en Node `20.13.1`.
- Next 16 et Prisma 7 demandent un Node plus recent.
- La stack est donc volontairement epinglee sur des versions compatibles avec cet environnement:
  - Next.js `15.5.13`
  - Prisma `6.x` pour la phase base de donnees

## Arborescence cible court terme

```text
.
|- apps/
|  \- web/
|     |- src/app
|     \- src/lib
\- docs/
   \- architecture/
```

## Implications backlog

- Tache 20: le modele de donnees multi-utilisateur pourra etre concu pour PostgreSQL et expose via Prisma.
- Taches 40 a 70: auth et protection des routes resteront dans le meme perimetre technique.
- Taches 320 a 340: les APIs produit seront exposees sous `app/api/*`.
