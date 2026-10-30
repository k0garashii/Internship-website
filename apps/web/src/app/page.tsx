import Link from "next/link";

const strengths = [
  "Profil utilisateur structuré et sauvegardé en base",
  "Ciblage d’entreprises compatibles avec le profil",
  "Détection de pages carrières et de portails de recrutement publics",
  "Collecte web initiale d’offres avec score exploratoire",
];

const availableFeatures = [
  {
    title: "Gestion de profil",
    description:
      "Inscription, connexion, profil complet, fenêtre de disponibilité et contraintes de candidature.",
  },
  {
    title: "Préférences et domaines",
    description:
      "Édition rapide des rôles, localisations, mots clés et domaines Gemini directement depuis une seule page.",
  },
  {
    title: "Recherche et email",
    description:
      "Suggestions d’entreprises, collecte publique d’offres, forwarding email dédié et normalisation commune.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 md:px-10 md:py-14">
      <section className="app-hero overflow-hidden">
        <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.35fr_0.85fr] md:px-10 md:py-12">
          <div className="space-y-6">
            <div className="status-pill status-pill-accent">
              Assistant de veille stage et emploi
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                Trouve des opportunités pertinentes même hors des circuits les plus visibles.
              </h1>
              <p className="app-copy max-w-2xl">
                Le produit centralise le profil candidat, déduit des entreprises cibles,
                cherche des offres publiques et prépare aussi une entrée par email pour
                récupérer des annonces qui ne remontent pas toujours sur LinkedIn.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                Créer un compte
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white/70 px-5 py-3 text-sm font-medium text-foreground transition-transform hover:-translate-y-0.5"
              >
                Me connecter
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-foreground p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--butter)]">
              Points forts
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-white/90">
              {strengths.map((item) => (
                <li
                  key={item}
                  className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {availableFeatures.map((feature) => (
          <article
            key={feature.title}
            className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]"
          >
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Disponible
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              {feature.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="app-kicker">
            Ce que permet déjà le MVP
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-foreground md:text-base">
            <li>Créer un compte, se connecter et protéger les routes privées.</li>
            <li>Structurer le profil et les contraintes de candidature.</li>
            <li>Générer puis corriger une base initiale de domaines.</li>
            <li>Identifier des entreprises et leur point d’entrée carrière.</li>
            <li>Prévisualiser des offres et préparer une collecte email en parallèle.</li>
          </ul>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="app-kicker">
            Ce que tu retrouves ensuite
          </p>
          <p className="mt-5 text-sm leading-7 text-foreground md:text-base">
            Une fois connecté, l’application te guide dans le même ordre que le besoin
            utilisateur: profil, préférences, recherche, emails et brouillons. La
            documentation technique reste disponible dans le README, mais l’accueil
            reste centré sur l’usage.
          </p>
        </article>
      </section>
    </main>
  );
}
