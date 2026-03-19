import Link from "next/link";

const strengths = [
  "Profil utilisateur structure et sauvegarde en base",
  "Ciblage d entreprises compatibles avec le profil",
  "Detection de pages carrieres et d ATS publics",
  "Collecte web initiale d offres avec score exploratoire",
];

const availableFeatures = [
  {
    title: "Gestion de profil",
    description:
      "Inscription, connexion, profil complet, fenetre de disponibilite et contraintes de candidature.",
  },
  {
    title: "Preferences et domaines",
    description:
      "Edition rapide des roles, localisations, mots cles et domaines Gemini directement depuis une seule page.",
  },
  {
    title: "Recherche et email",
    description:
      "Suggestions d entreprises, collecte publique d offres, forwarding email dedie et normalisation commune.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 md:px-10 md:py-14">
      <section className="overflow-hidden rounded-[2rem] border border-line bg-card shadow-[0_20px_80px_rgba(31,41,55,0.08)] backdrop-blur">
        <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.35fr_0.85fr] md:px-10 md:py-12">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-line bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-muted">
              Assistant de veille stage et emploi
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                Trouve des opportunites pertinentes meme hors des circuits les plus visibles.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted md:text-lg">
                Le produit centralise le profil candidat, deduit des entreprises cibles,
                cherche des offres publiques et prepare aussi une entree par email pour
                recuperer des annonces qui ne remontent pas toujours sur LinkedIn.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                Creer un compte
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-full border border-line bg-white/70 px-5 py-3 text-sm font-medium text-foreground transition-transform hover:-translate-y-0.5"
              >
                Me connecter
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-line bg-slate-950 p-6 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-teal-300">
              Points forts
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-100">
              {strengths.map((item) => (
                <li key={item} className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3">
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
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Ce que permet deja le MVP
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-foreground md:text-base">
            <li>Creer un compte, se connecter et proteger les routes privees.</li>
            <li>Structurer le profil et les contraintes de candidature.</li>
            <li>Generer puis corriger une base initiale de domaines.</li>
            <li>Identifier des entreprises et leur point d entree carriere.</li>
            <li>Previsualiser des offres et preparer une collecte email en parallele.</li>
          </ul>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Reference technique
          </p>
          <p className="mt-5 text-sm leading-7 text-foreground md:text-base">
            Le detail de la stack, de l architecture et des decisions techniques a ete
            deplace dans le README et dans `docs/architecture`. La page de garde reste
            volontairement centree sur le produit et les fonctionnalites visibles.
          </p>
        </article>
      </section>
    </main>
  );
}
