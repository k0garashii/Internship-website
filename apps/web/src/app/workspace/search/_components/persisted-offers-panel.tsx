import Link from "next/link";

import type { PersistedOfferListResult } from "@/lib/search/types";
import { OfferFeedbackControls } from "./offer-feedback-controls";
import { OfferDraftGenerator } from "./offer-draft-generator";

type Props = {
  result: PersistedOfferListResult;
};

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

const searchRunLabels: Record<string, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  COMPLETED: "Terminee",
  PARTIAL: "Partielle",
  FAILED: "En erreur",
  CANCELED: "Annulee",
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

function formatStatusLabel(value: string) {
  return lifecycleLabels[value] ?? value;
}

function formatFeedbackLabel(value: string | null) {
  if (!value) {
    return "Aucun retour";
  }

  return feedbackLabels[value] ?? value;
}

function formatSearchRunLabel(value: string | null) {
  if (!value) {
    return "Aucune recherche";
  }

  return searchRunLabels[value] ?? value;
}

export function PersistedOffersPanel({ result }: Props) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="app-kicker">
            Offres persistees
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Offres deja stockees avec leur etat courant.
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-foreground">{result.summary}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="surface-muted rounded-[1.25rem] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Total</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {result.offerCount}
            </p>
          </div>
          <div className="surface-muted rounded-[1.25rem] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Shortlist</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {result.statusCounts.SHORTLISTED ?? 0}
            </p>
          </div>
          <div className="surface-muted rounded-[1.25rem] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Candidatees</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {result.statusCounts.APPLIED ?? 0}
            </p>
          </div>
        </div>
      </div>

      {result.offers.length > 0 ? (
        <div className="mt-6 space-y-4">
          {result.offers.map((offer) => (
            <article
              key={offer.id}
              className="rounded-[1.5rem] border border-line bg-white/70 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                      {offer.sourceSite}
                    </span>
                    <span className="status-pill status-pill-success">
                      {formatStatusLabel(offer.lifecycleStatus)}
                    </span>
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                      {formatFeedbackLabel(offer.latestFeedbackDecision)}
                    </span>
                    {offer.isShortlisted ? (
                      <span className="status-pill status-pill-accent">
                        Shortlist
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <Link
                      href={`/workspace/search/offers/${offer.id}`}
                      className="text-xl font-semibold tracking-tight text-foreground transition hover:text-[var(--accent)]"
                    >
                      {offer.title}
                    </Link>
                    <p className="mt-2 text-sm text-muted md:text-base">
                      {offer.companyName}
                      {offer.locationLabel ? ` - ${offer.locationLabel}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <span className="text-sm text-muted">
                    Derniere vue le {formatDateTime(offer.lastSeenAt)}
                  </span>
                  <Link
                    href={`/workspace/search/offers/${offer.id}`}
                    className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
                  >
                    Voir le detail
                  </Link>
                  <a
                    href={offer.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
                  >
                    Ouvrir l offre
                  </a>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">
                    Dernier match
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {offer.latestMatchScore ?? "n/a"}
                    {offer.latestMatchScore !== null ? "/100" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Rang {offer.latestRank ?? "n/a"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">
                    Derniere recherche
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {offer.latestSearchLabel ?? "Aucune recherche"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatSearchRunLabel(offer.latestSearchStatus)}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Publiee</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {formatDateTime(offer.postedAt)}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">
                    Premiere apparition
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {formatDateTime(offer.firstSeenAt)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-sm font-medium text-foreground">
                    Justification du dernier match
                  </p>
                  <p className="mt-2 text-sm leading-7 text-foreground">
                    {offer.matchExplanation ?? "Aucune justification stockee pour cette offre."}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-line bg-card p-4">
                  <p className="text-sm font-medium text-foreground">Retour utilisateur</p>
                  <p className="mt-2 text-sm leading-7 text-foreground">
                    {offer.latestFeedbackNote ??
                      "Aucun retour manuel n a encore ete enregistre pour cette offre."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                <OfferFeedbackControls
                  offerId={offer.id}
                  currentDecision={offer.latestFeedbackDecision}
                  currentNote={offer.latestFeedbackNote}
                />
                <OfferDraftGenerator jobOfferId={offer.id} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <article className="mt-6 rounded-[1.5rem] border border-dashed border-line bg-white/70 p-6 text-sm leading-7 text-muted">
          Lance une collecte pour commencer a remplir la base d offres et suivre leur
          statut ici.
        </article>
      )}
    </section>
  );
}
