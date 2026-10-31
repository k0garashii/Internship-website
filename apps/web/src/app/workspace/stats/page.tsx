import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/lib/auth/session";
import type { WeeklyStats } from "@/lib/stats/search-stats";
import { getSearchStatsForUser } from "@/lib/stats/search-stats-loader";

const weekFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const percentFormatter = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

function formatRate(value: number | null) {
  return value === null ? "–" : percentFormatter.format(value);
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-6 text-muted">{hint}</p>
    </article>
  );
}

function WeeklyBarChart({
  title,
  weeks,
  metric,
  unit,
}: {
  title: string;
  weeks: WeeklyStats[];
  metric: "discovered" | "applied";
  unit: string;
}) {
  const max = Math.max(1, ...weeks.map((week) => week[metric]));
  const total = weeks.reduce((sum, week) => sum + week[metric], 0);

  return (
    <figure className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted">
          {total} sur 8 semaines
        </span>
      </figcaption>
      <div className="mt-5 flex h-40 items-end gap-2 border-b border-line" role="list">
        {weeks.map((week) => {
          const value = week[metric];
          const label = `Semaine du ${weekFormatter.format(week.weekStart)} : ${value} ${unit}`;

          return (
            <div
              key={week.weekStart.toISOString()}
              role="listitem"
              aria-label={label}
              title={label}
              className="group relative flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{
                  height: value === 0 ? "2px" : `${Math.max(4, (value / max) * 100)}%`,
                  background: value === 0 ? "var(--line)" : "var(--accent)",
                }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-xs text-white group-hover:block">
                {value}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 text-[0.65rem] text-muted">
        {weeks.map((week, index) => (
          <span key={week.weekStart.toISOString()} className="flex-1 text-center">
            {index % 2 === 1 || index === weeks.length - 1 ? weekFormatter.format(week.weekStart) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

export default async function StatsPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  const stats = await getSearchStatsForUser(viewer.userId);
  const { totals, rates } = stats;

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">Statistiques</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Où en est ta recherche.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          Les taux se basent sur les étapes du suivi des candidatures : une réponse est
          comptée quand une candidature passe en entretien, offre acceptée ou refus.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Offres découvertes"
          value={String(totals.discovered)}
          hint={`${totals.kept} retenue(s), soit ${formatRate(rates.keptRate)}`}
        />
        <StatTile
          label="Candidatures"
          value={String(totals.applied)}
          hint={`${totals.interviews} entretien(s), ${totals.accepted} offre(s) acceptée(s)`}
        />
        <StatTile
          label="Taux de réponse"
          value={formatRate(rates.responseRate)}
          hint={`${totals.responded} réponse(s) dont ${totals.rejected} refus`}
        />
        <StatTile
          label="Délai de réponse"
          value={stats.medianResponseDays === null ? "–" : `${stats.medianResponseDays} j`}
          hint="Médiane entre l’envoi et la première réponse"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <WeeklyBarChart title="Offres découvertes par semaine" weeks={stats.weekly} metric="discovered" unit="offre(s)" />
        <WeeklyBarChart title="Candidatures envoyées par semaine" weeks={stats.weekly} metric="applied" unit="candidature(s)" />
      </section>

      <section className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Efficacité des sources</h2>
        <p className="mt-1 text-sm text-muted">
          Quelles sources apportent des offres que tu retiens et qui mènent à des réponses.
        </p>
        {stats.sources.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Lance une recherche pour voir apparaître tes sources.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 text-right font-medium">Offres</th>
                  <th className="py-2 pr-4 text-right font-medium">Retenues</th>
                  <th className="py-2 pr-4 text-right font-medium">Candidatures</th>
                  <th className="py-2 pr-4 text-right font-medium">Réponses</th>
                  <th className="py-2 text-right font-medium">Entretiens</th>
                </tr>
              </thead>
              <tbody>
                {stats.sources.map((source) => (
                  <tr key={source.sourceSite} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-foreground">{source.sourceSite}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{source.discovered}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{source.kept}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{source.applied}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{source.responded}</td>
                    <td className="py-2 text-right tabular-nums">{source.interviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
