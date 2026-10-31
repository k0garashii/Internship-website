import Link from "next/link";

import type { getTodaySummaryForUser } from "@/lib/dashboard/today";

const interviewFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

type Props = {
  summary: Awaited<ReturnType<typeof getTodaySummaryForUser>>;
};

function Column({
  label,
  count,
  href,
  linkLabel,
  empty,
  children,
}: {
  label: string;
  count: number;
  href: string;
  linkLabel: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">{count}</p>
      <div className="mt-3 flex-1 space-y-2 text-sm">{count > 0 ? children : <p className="text-muted">{empty}</p>}</div>
      <Link href={href} className="mt-4 text-sm font-medium text-foreground underline">
        {linkLabel}
      </Link>
    </article>
  );
}

export function TodayPanel({ summary }: Props) {
  return (
    <section className="grid gap-4 md:grid-cols-3" aria-label="Aujourd’hui">
      <Column
        label="Nouvelles offres (24 h)"
        count={summary.newOfferCount}
        href="/workspace/search"
        linkLabel="Voir les offres"
        empty="Rien de nouveau depuis hier."
      >
        {summary.topNewOffers.map((offer) => (
          <Link key={offer.id} href={`/workspace/search/offers/${offer.id}`} className="block leading-6 hover:underline">
            <span className="text-foreground">{offer.title}</span>
            <span className="text-muted">
              {" "}
              · {offer.companyName}
              {offer.scorePercent !== null ? ` · ${offer.scorePercent} %` : ""}
            </span>
          </Link>
        ))}
      </Column>
      <Column
        label="À relancer"
        count={summary.followUpsDue.length}
        href="/workspace/applications"
        linkLabel="Ouvrir les candidatures"
        empty="Aucune relance en attente."
      >
        {summary.followUpsDue.map((offer) => (
          <p key={offer.id} className="leading-6">
            <span className="text-foreground">{offer.title}</span>
            <span className="text-muted"> · {offer.companyName}</span>
          </p>
        ))}
      </Column>
      <Column
        label="Entretiens (7 jours)"
        count={summary.upcomingInterviews.length}
        href="/workspace/applications"
        linkLabel="Voir le suivi"
        empty="Aucun entretien prévu."
      >
        {summary.upcomingInterviews.map((offer) => (
          <p key={offer.id} className="leading-6">
            <span className="text-foreground">{interviewFormatter.format(offer.interviewAt)}</span>
            <span className="text-muted">
              {" "}
              · {offer.title}, {offer.companyName}
            </span>
          </p>
        ))}
      </Column>
    </section>
  );
}
