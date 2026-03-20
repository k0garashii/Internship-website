import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logServiceError } from "@/lib/observability/error-logging";
import { buildSearchQueryPlan, type SearchQueryPlan } from "@/lib/search/query-plan";
import { CompanyTargetsPanel } from "./_components/company-targets-panel";
import { SearchDiscoveryPanel } from "./_components/search-discovery-panel";

function ChipGroup({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          {title}
        </p>
        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-line bg-white px-3 py-2 text-sm text-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-muted">{emptyLabel}</p>
      )}
    </div>
  );
}

function SearchPlanOverview({ plan }: { plan: SearchQueryPlan }) {
  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Profil pris en compte
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Ce que le moteur lit vraiment avant de chercher.
          </h2>
          <p className="mt-3 text-sm leading-7 text-foreground">{plan.summary}</p>

          <div className="mt-6 space-y-6">
            <ChipGroup
              title="Roles"
              items={plan.inputs.targetRoles}
              emptyLabel="Aucun role cible exploitable n a ete detecte."
            />
            <ChipGroup
              title="Domaines"
              items={plan.inputs.domains}
              emptyLabel="Aucun domaine valide n a ete retenu pour la collecte."
            />
            <ChipGroup
              title="Mots cles"
              items={plan.inputs.keywords}
              emptyLabel="Aucun mot-cle complementaire n a ete retenu."
            />
            <ChipGroup
              title="Zones"
              items={plan.inputs.locations}
              emptyLabel="La collecte restera large tant qu aucune zone n est precisee."
            />
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Plan de collecte
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Variantes qui vont etre lancees en priorite.
              </h2>
              <p className="text-sm leading-7 text-foreground">
                Les variantes sont ordonnees pour couvrir d abord la diversite des roles
                cibles, puis alterner les domaines et les zones au lieu de repeter
                toujours la meme combinaison.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Variantes
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {plan.queries.length}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Source</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  Welcome to the Jungle
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-6 space-y-3 text-sm leading-7 text-foreground">
            {plan.strategy.map((item) => (
              <li
                key={item}
                className="rounded-[1.25rem] border border-line bg-white/70 px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Requetes prevues
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Apercu complet du plan avant execution.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-muted">
            Chaque carte montre le role principal, le domaine associe, la zone prise en
            compte et les mots-cles vraiment ajoutes a la requete.
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {plan.queries.map((query) => (
            <article
              key={query.id}
              className="rounded-[1.5rem] border border-line bg-white/70 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">{query.label}</p>
                  <p className="text-sm leading-7 text-muted">{query.explanation}</p>
                </div>
                <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900">
                  Priorite {query.priority}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Role</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {query.targetRole}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Domaine</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {query.domain ?? "Sans filtre domaine"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Zone</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {query.location ?? "Aucune precision de zone"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">
                    Mots cles injectes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {query.focusKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-line bg-slate-950 px-4 py-3 text-sm leading-7 text-slate-100">
                  {query.queryText}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default async function SearchPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  let plan: SearchQueryPlan | null = null;
  let configurationError: string | null = null;

  try {
    const config = await exportUserConfig(viewer);
    plan = buildSearchQueryPlan(config.personalProfile, config.searchTargets);
  } catch (error) {
    if (error instanceof UserConfigError) {
      logServiceError({
        level: error.status >= 500 ? "error" : "warn",
        scope: "workspace/search/page",
        message: "Search page failed to load a handled configuration error",
        error,
        metadata: {
          userId: viewer.userId,
        },
      });

      configurationError = error.message;
    } else {
      logServiceError({
        scope: "workspace/search/page",
        message: "Search page failed with an unexpected error while building the plan",
        error,
        metadata: {
          userId: viewer.userId,
        },
      });

      configurationError = "Impossible de preparer la recherche initiale";
    }
  }

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
          Recherche d offres
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Construire un plan de collecte qui ressemble vraiment a ton profil.
        </h1>
        <p className="mt-4 max-w-4xl text-base leading-8 text-muted md:text-lg">
          Cette page ne montre plus seulement quelques tags tronques. Elle affiche ce que
          le moteur a retenu de ton profil, les variantes de requetes prevues et, ensuite,
          l execution reelle sur les sources publiques disponibles.
        </p>
      </section>

      {configurationError ? (
        <section className="rounded-[1.75rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {configurationError}
        </section>
      ) : plan ? (
        <SearchPlanOverview plan={plan} />
      ) : null}

      <CompanyTargetsPanel disabled={Boolean(configurationError)} />

      <SearchDiscoveryPanel disabled={Boolean(configurationError)} />
    </main>
  );
}
