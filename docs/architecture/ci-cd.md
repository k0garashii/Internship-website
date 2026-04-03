# CI CD

Le repo dispose maintenant d une base CI/CD GitHub Actions:

- `ci.yml`: validation Prisma, lint, tests et build sur `main` et pull requests
- `deployment-check.yml`: rappel des prerequis de deploiement pour Vercel/Supabase

Le deploiement applicatif reste porte par Vercel, mais la verification continue est maintenant explicite dans le repo.
