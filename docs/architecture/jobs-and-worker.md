# Jobs Et Worker

Une file applicative minimale existe maintenant pour sortir les traitements longs du parcours HTTP.

Modeles:

- `AppJob`
- `AppJobRun`

Services:

- `job-queue-service.ts`: enqueue, claim, complete, fail, cancel
- `job-worker-service.ts`: execution des jobs connus

Types de jobs supportes:

- `PROFILE_ENRICHMENT_REFRESH`
- `SEARCH_DISCOVERY_RUN`
- `GMAIL_SYNC`

Commande locale:

```bash
npm run worker
```

Pour drainer une seule tache:

```bash
npm run jobs:drain -- --once
```
