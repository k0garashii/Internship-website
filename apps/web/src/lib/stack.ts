export const stackDecision = {
  project: "InternshipScrapper",
  headline:
    "Le socle produit couvre maintenant auth, profil, ciblage d entreprises, collecte web initiale et pipeline email entrant.",
  frontend: {
    title: "Frontend",
    summary: "Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4",
  },
  backend: {
    title: "Backend",
    summary:
      "Route Handlers et composants serveur Next.js sur runtime Node.js",
  },
  data: {
    title: "Donnees",
    summary: "PostgreSQL cible, Prisma 6 retenu pour la phase base/auth",
  },
  validation: {
    title: "Validation",
    summary: "Schemas TypeScript partages, Zod prevu pour les formulaires et APIs",
  },
  reasons: [
    "Une seule application suffit pour les taches d'authentification, d'onboarding et de lecture ecriture de profil.",
    "Les endpoints produit pourront vivre sous app/api sans deployer un backend separe trop tot.",
    "La structure apps/web garde la porte ouverte a un futur worker de collecte si le scraping grossit.",
    "Les versions retenues restent compatibles avec le Node local actuel 20.13.1.",
  ],
  nextBacklog: [
    "Ordre 252: parser les emails d offres et de recruteurs en opportunites structurees",
    "Ordre 260: persister les offres et les runs de recherche",
    "Ordre 270: dedupliquer les opportunites inter-sources",
    "Ordres 280 et 290: scorer puis matcher les opportunites par rapport au profil",
  ],
} as const;
