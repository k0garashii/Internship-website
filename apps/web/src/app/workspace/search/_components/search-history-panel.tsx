import Link from "next/link";

import type { SearchHistoryResult } from "@/lib/search/types";

type Props = {
  result: SearchHistoryResult;
};

const runStatusLabels: Record<string, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  COMPLETED: "Terminee",
  PARTIAL: "Partielle",
  FAILED: "En erreur",
  CANCELED: "Annulee",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatusLabel(value: string) {
  return runStatusLabels[value] ?? value;
}

export function SearchHistoryPanel({ result }: Props) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="app-kicker">
            Historique
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Recherches deja lancees sur ce compte.
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-foreground">{result.summary}</p>
        </div>
        <div className="surface-muted rounded-[1.25rem] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Recherches</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{result.runCount}</p>
        </div>
      </div>

      {result.runs.length > 0 ? (
        <div className="mt-6 space-y-4">
          {result.runs.map((run) => {
            const createdAt = formatDateTime(run.createdAt);
            const startedAt = formatDateTime(run.startedAt);
            const completedAt = formatDateTime(run.completedAt);

            return (
            <article
              key={run.id}
              className="rounded-[1.5rem] border border-line bg-white/70 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                      {formatStatusLabel(run.status)}
                    </span>
                    <span className="status-pill status-pill-info">
                      {run.resultCount} offre(s)
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">
                      {run.label}
                    </h3>
                    {createdAt ? (
                      <p className="mt-2 text-sm text-muted">
                        Creee le {createdAt}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {startedAt ? (
                    <div className="rounded-[1.25rem] border border-line bg-card p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Debut</p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {startedAt}
                      </p>
                    </div>
                  ) : null}
                  {completedAt ? (
                    <div className="rounded-[1.25rem] border border-line bg-card p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Fin</p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {completedAt}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {run.queryText ? (
                <div className="mt-4 rounded-[1.25rem] border border-[rgba(82,71,101,0.18)] bg-foreground px-4 py-3 text-sm leading-7 text-white/90">
                  {run.queryText}
                </div>
              ) : null}

              {run.errorMessage ? (
                <div className="mt-4 rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {run.errorMessage}
                </div>
              ) : null}

              <div className="mt-4">
                <p className="text-sm font-medium text-foreground">Top offres de cette recherche</p>
                {run.topOffers.length > 0 ? (
                  <div className="mt-3 grid gap-3 xl:grid-cols-3">
                    {run.topOffers.map((offer) => (
                      <Link
                        key={`${run.id}-${offer.jobOfferId}`}
                        href={`/workspace/search/offers/${offer.jobOfferId}`}
                        className="rounded-[1.25rem] border border-line bg-card p-4 transition hover:-translate-y-0.5"
                      >
                        <p className="text-sm font-medium text-foreground">{offer.title}</p>
                        <p className="mt-1 text-sm text-muted">{offer.companyName}</p>
                        {(offer.rank !== null || offer.matchScore !== null) ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {offer.rank !== null ? (
                              <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                                Rang {offer.rank}
                              </span>
                            ) : null}
                            {offer.matchScore !== null ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                                Match {offer.matchScore}/100
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-7 text-muted">
                    Aucun top resultat detaille n est encore disponible pour ce run.
                  </p>
                )}
              </div>
            </article>
          );
          })}
        </div>
      ) : (
        <article className="mt-6 rounded-[1.5rem] border border-dashed border-line bg-white/70 p-6 text-sm leading-7 text-muted">
          Lance une premiere recherche pour commencer a remplir l historique.
        </article>
      )}
    </section>
  );
}
