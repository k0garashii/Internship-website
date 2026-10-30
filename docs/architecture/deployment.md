# Deploiement initial

## Cible retenue

- code source sur GitHub
- application Next.js sur Vercel
- PostgreSQL sur Supabase

## Variables d environnement attendues

La liste complete et commentee est dans `apps/web/.env.example`.

- `DATABASE_URL`: URL pooler / session pour le runtime applicatif
- `DIRECT_URL`: URL directe pour Prisma
- `APP_BASE_URL`: URL publique de l application (redirections OAuth, liens d invitation)
- `APP_SECRET`: secret aleatoire d au moins 32 caracteres (`openssl rand -base64 48`), obligatoire en production. Il signe l etat OAuth et chiffre les tokens Gmail : le changer oblige les utilisateurs a reconnecter Gmail.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optionnels, requis pour Gmail
- `GEMINI_API_KEY`: optionnel mais requis pour la generation Gemini
- `EMAIL_FORWARDING_DOMAIN`: domaine ou adresse de forwarding configuree

## Parametrage Vercel

- `Root Directory`: `apps/web`
- framework: `Next.js`
- Node.js: `22.x`

## Etapes minimales

1. pousser le repo sur GitHub
2. connecter le repo a Vercel
3. renseigner les variables d environnement sur le projet Vercel
4. appliquer les migrations versionnees contre la base cible : `npm run db:migrate:deploy` (depuis `apps/web`, avec `DIRECT_URL` pointant sur la base)
5. redeployer
6. verifier inscription, connexion, onboarding, recherche et persistance

## Migrations Prisma

Le schema est maintenant versionne dans `apps/web/prisma/migrations`. `0_init` correspond exactement au schema qui existait avant leur introduction.

Pour une base deja creee avec `prisma db push`, il faut marquer cette migration initiale comme appliquee une seule fois, puis deployer les suivantes :

```bash
npx prisma migrate resolve --applied 0_init
npx prisma migrate deploy
```

Ne plus utiliser `prisma db push` sur la base de production : toute evolution du schema passe par `npm run db:migrate:dev` en local, qui genere une nouvelle migration a commiter.

## Risques connus

- `DATABASE_URL` configuree uniquement sur `Preview` au lieu de `Production`
- cookies `secure` en environnement `production`, donc tests locaux HTTP a traiter via `next dev`
- build Next incoherent si plusieurs serveurs reutilisent le meme cache `.next`
