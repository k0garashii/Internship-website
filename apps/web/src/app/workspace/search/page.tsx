import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, exportUserConfig } from "@/lib/config/user-config";
import { logServiceError } from "@/lib/observability/error-logging";
import { listSearchHistoryForUser } from "@/lib/search/history";
import { listPersistedOffersForUser } from "@/lib/search/listing";
import { buildSearchQueryPlan, type SearchQueryPlan } from "@/lib/search/query-plan";
import { CompanyTargetsPanel } from "./_components/company-targets-panel";
import { PersistedOffersPanel } from "./_components/persisted-offers-panel";
import { SearchHistoryPanel } from "./_components/search-history-panel";
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
      <section className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="app-kicker">
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
                <span className="status-pill status-pill-info">
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
                        className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-[rgba(82,71,101,0.18)] bg-foreground px-4 py-3 text-sm leading-7 text-white/90">
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
  let persistedOffersError: string | null = null;
  let persistedOffers = null;
  let searchHistoryError: string | null = null;
  let searchHistory = null;

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

  try {
    persistedOffers = await listPersistedOffersForUser(viewer.userId);
  } catch (error) {
    logServiceError({
      scope: "workspace/search/page",
      message: "Search page failed to list persisted offers",
      error,
      metadata: {
        userId: viewer.userId,
      },
    });

    persistedOffersError = "Impossible de charger les offres deja persistees.";
  }

  try {
    searchHistory = await listSearchHistoryForUser(viewer.userId);
  } catch (error) {
    logServiceError({
      scope: "workspace/search/page",
      message: "Search page failed to load search history",
      error,
      metadata: {
        userId: viewer.userId,
      },
    });

    searchHistoryError = "Impossible de charger l historique des recherches.";
  }

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">
          Collecte d&apos;offres
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Afficher des offres qui ressemblent vraiment a ton profil.
        </h1>
        <div className="status-row mt-6">
          <div className="status-pill status-pill-info">Entreprises et pages carrieres</div>
          <div className="status-pill status-pill-success">Offres personnalisées</div>
        </div>
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

      {persistedOffersError ? (
        <section className="rounded-[1.75rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {persistedOffersError}
        </section>
      ) : persistedOffers ? (
        <PersistedOffersPanel result={persistedOffers} />
      ) : null}

      {searchHistoryError ? (
        <section className="rounded-[1.75rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {searchHistoryError}
        </section>
      ) : searchHistory ? (
        <SearchHistoryPanel result={searchHistory} />
      ) : null}
    </main>
  );
}
