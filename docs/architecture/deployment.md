# Deploiement initial

## Cible retenue

- code source sur GitHub
- application Next.js sur Vercel
- PostgreSQL sur Supabase

## Variables d environnement attendues

- `DATABASE_URL`: URL pooler / session pour le runtime applicatif
- `DIRECT_URL`: URL directe pour Prisma
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
4. executer `prisma db push` contre la base cible
5. redeployer
6. verifier inscription, connexion, onboarding, recherche et persistance

## Risques connus

- `DATABASE_URL` configuree uniquement sur `Preview` au lieu de `Production`
- cookies `secure` en environnement `production`, donc tests locaux HTTP a traiter via `next dev`
- build Next incoherent si plusieurs serveurs reutilisent le meme cache `.next`
