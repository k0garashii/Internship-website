import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  SearchOfferListingError,
  getPersistedOfferDetailForUser,
} from "@/lib/search/listing";

const lifecycleLabels: Record<string, string> = {
  DISCOVERED: "Decouverte",
  NORMALIZED: "Normalisee",
  SCORED: "Scoree",
  SHORTLISTED: "Shortlistee",
  APPLIED: "Candidatee",
  ARCHIVED: "Archivee",
};

const feedbackLabels: Record<string, string> = {
  NOT_RELEVANT: "Non pertinente",
  MAYBE: "A revoir",
  FAVORITE: "Favorite",
  APPLIED: "Candidature envoyee",
  INTERVIEWING: "Entretien",
  REJECTED: "Refusee",
  OFFER_ACCEPTED: "Offre acceptee",
};

const workModeLabels: Record<string, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybride",
  ONSITE: "Sur site",
  FLEXIBLE: "Flexible",
};

const contractLabels: Record<string, string> = {
  INTERNSHIP: "Stage",
  APPRENTICESHIP: "Alternance",
  FULL_TIME: "Temps plein",
  PART_TIME: "Temps partiel",
  TEMPORARY: "Temporaire",
  FREELANCE: "Freelance",
};

const runStatusLabels: Record<string, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  COMPLETED: "Terminee",
  PARTIAL: "Partielle",
  FAILED: "En erreur",
  CANCELED: "Annulee",
};

const draftStatusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  READY_FOR_REVIEW: "A relire",
  APPROVED: "Approuve",
  SENT: "Envoye",
  ARCHIVED: "Archive",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Inconnue";
  }

  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null) {
  if (!value) {
    return "Inconnue";
  }

  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type PageProps = {
  params: Promise<{
    offerId: string;
  }>;
};

export default async function OfferDetailPage({ params }: PageProps) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const { offerId } = await params;

  try {
    const detail = await getPersistedOfferDetailForUser(viewer.userId, offerId);
    const { offer } = detail;

    return (
      <main className="flex min-h-full flex-col gap-8">
        <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Link
                href="/workspace/search"
                className="inline-flex items-center rounded-full border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted transition hover:bg-white/70"
              >
                Retour a la recherche
              </Link>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                  {offer.sourceSite}
                </span>
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
                  {lifecycleLabels[offer.lifecycleStatus] ?? offer.lifecycleStatus}
                </span>
                {offer.latestMatchScore !== null ? (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                    Match {offer.latestMatchScore}/100
                  </span>
                ) : null}
                {offer.latestMatchLabel ? (
                  <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                    {offer.latestMatchLabel}
                  </span>
                ) : null}
                {offer.latestFeedbackDecision ? (
                  <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-900">
                    {feedbackLabels[offer.latestFeedbackDecision] ?? offer.latestFeedbackDecision}
                  </span>
                ) : null}
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                  Fiche detail offre
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                  {offer.title}
                </h1>
                <p className="mt-3 text-base leading-8 text-muted md:text-lg">
                  {offer.companyName}
                  {offer.locationLabel ? ` - ${offer.locationLabel}` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <a
                href={offer.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
              >
                Ouvrir l offre source
              </a>
              <Link
                href="/workspace/drafts"
                className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
              >
                Voir les brouillons
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Contrat
            </p>
            <p className="mt-3 text-lg font-medium text-foreground">
              {offer.employmentType ? contractLabels[offer.employmentType] : "Non precise"}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Mode
            </p>
            <p className="mt-3 text-lg font-medium text-foreground">
              {offer.workMode ? workModeLabels[offer.workMode] : "Non precise"}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Publication
            </p>
            <p className="mt-3 text-lg font-medium text-foreground">{formatDate(offer.postedAt)}</p>
          </article>
          <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Derniere vue
            </p>
            <p className="mt-3 text-lg font-medium text-foreground">
              {formatDateTime(offer.lastSeenAt)}
            </p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Contenu
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              Resume normalise et contexte collecte
            </h2>
            <p className="mt-4 text-sm leading-7 text-foreground">
              {offer.description ?? "Aucune description normalisee n a ete persistée pour cette offre."}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Requetes reliees
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {offer.matchedQueryLabels.length > 0 ? (
                    offer.matchedQueryLabels.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">Aucune etiquette de requete conservee.</span>
                  )}
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Mots cles retrouves
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {offer.matchedKeywords.length > 0 ? (
                    offer.matchedKeywords.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">Aucune occurrence forte stockee.</span>
                  )}
                </div>
              </div>
            </div>

            {offer.normalizedOpportunity ? (
              <div className="mt-6 rounded-[1.25rem] border border-line bg-white/70 p-4 text-sm leading-7 text-foreground">
                Format commun: {offer.normalizedOpportunity.sourceLabel}
                {offer.normalizedOpportunity.signal
                  ? ` / signal ${offer.normalizedOpportunity.signal}`
                  : ""}
                . Capturee le {formatDateTime(offer.normalizedOpportunity.capturedAt)}.
              </div>
            ) : null}
          </article>

          <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Matching
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              Pourquoi cette offre remonte
            </h2>
            <p className="mt-4 text-sm leading-7 text-foreground">
              {offer.latestMatchExplanation ?? "Aucune justification de matching n a ete persistée."}
            </p>

            {offer.matchingBreakdown.length > 0 ? (
              <div className="mt-6 space-y-3">
                {offer.matchingBreakdown.map((item) => (
                  <div
                    key={`${offer.id}-${item.criterion}`}
                    className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{item.criterion}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        +{item.awarded}/{item.max}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-foreground">{item.reason}</p>
                    {item.matchedTerms.length > 0 ? (
                      <p className="mt-2 text-xs leading-6 text-muted">
                        {item.matchedTerms.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Historique des runs
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              Trace des recherches ayant fait remonter cette offre
            </h2>

            <div className="mt-6 space-y-3">
              {detail.searchMatches.length > 0 ? (
                detail.searchMatches.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground">
                        {runStatusLabels[entry.searchRunStatus] ?? entry.searchRunStatus}
                      </span>
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                        Match {entry.rawScore ?? "n/a"}
                        {entry.rawScore !== null ? "/100" : ""}
                      </span>
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        Rang {entry.rank ?? "n/a"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">{entry.searchRunLabel}</p>
                    <p className="mt-1 text-sm leading-7 text-muted">
                      Decouverte le {formatDateTime(entry.discoveredAt)}
                    </p>
                    {entry.matchExplanation ? (
                      <p className="mt-2 text-sm leading-7 text-foreground">
                        {entry.matchExplanation}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-muted">
                  Aucun historique de run detaille n est disponible.
                </p>
              )}
            </div>
          </article>

          <div className="space-y-6">
            <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Feedback utilisateur
              </p>
              <div className="mt-6 space-y-3">
                {detail.feedbackEntries.length > 0 ? (
                  detail.feedbackEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-900">
                          {feedbackLabels[entry.decision] ?? entry.decision}
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                        Mis a jour le {formatDateTime(entry.updatedAt)}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-foreground">
                        {entry.note ?? "Aucune note complementaire."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-muted">
                    Aucun feedback n a encore ete saisi sur cette offre.
                  </p>
                )}
              </div>
            </article>

            <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Brouillons
              </p>
              <div className="mt-6 space-y-3">
                {detail.drafts.length > 0 ? (
                  detail.drafts.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground">
                          {draftStatusLabels[entry.status] ?? entry.status}
                        </span>
                        {entry.generatedBy ? (
                          <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900">
                            {entry.generatedBy}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm font-medium text-foreground">
                        {entry.subject ?? "Sujet non genere"}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-foreground">
                        {entry.personalizationSummary ?? "Aucun resume de personnalisation."}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                        Mis a jour le {formatDateTime(entry.updatedAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-muted">
                    Aucun brouillon n a encore ete genere pour cette offre.
                  </p>
                )}
              </div>
            </article>

            <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Deduplication
              </p>
              <p className="mt-4 text-sm leading-7 text-foreground">
                {offer.deduplication.sourceUrls.length} URL source,{" "}
                {offer.deduplication.sourceOfferIds.length} identifiant(s) externes et{" "}
                {offer.deduplication.providers.length} provider(s) rattaches a cette offre.
              </p>
            </article>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof SearchOfferListingError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
