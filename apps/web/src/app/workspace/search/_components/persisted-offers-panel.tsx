"use client";

import Link from "next/link";

import type { PersistedOfferListResult } from "@/lib/search/types";
import { DeletePersistedOfferButton } from "./delete-persisted-offer-button";
import { OfferFeedbackControls } from "./offer-feedback-controls";
import { OfferDraftGenerator } from "./offer-draft-generator";
import { trackSearchInteraction } from "./search-interactions";

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
    return null;
  }

  return searchRunLabels[value] ?? value;
}

export function PersistedOffersPanel({ result }: Props) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="app-kicker">
            Offres enregistrees
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
          {result.offers.map((offer) => {
            const lastSeenAt = formatDateTime(offer.lastSeenAt);
            const latestSearchStatus = formatSearchRunLabel(offer.latestSearchStatus);
            const postedAt = formatDateTime(offer.postedAt);
            const firstSeenAt = formatDateTime(offer.firstSeenAt);
            const hasLatestMatch =
              offer.latestMatchScore !== null || offer.latestRank !== null;
            const hasLatestSearch =
              Boolean(offer.latestSearchLabel) || Boolean(latestSearchStatus);
            const hasContextCard =
              Boolean(offer.matchExplanation) || Boolean(offer.latestFeedbackNote);

            return (
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
                    {offer.latestFeedbackDecision ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                        {formatFeedbackLabel(offer.latestFeedbackDecision)}
                      </span>
                    ) : null}
                    {offer.isShortlisted ? (
                      <span className="status-pill status-pill-accent">
                        Shortlist
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <Link
                      href={`/workspace/search/offers/${offer.id}`}
                      onClick={() => {
                        void trackSearchInteraction({
                          type: "SEARCH_RESULT_OPENED",
                          jobOfferId: offer.id,
                          sourceUrl: offer.sourceUrl,
                          offerContext: {
                            title: offer.title,
                            companyName: offer.companyName,
                            locationLabel: offer.locationLabel,
                            matchedQueryLabels: [],
                            matchedKeywords: [],
                          },
                          metadata: {
                            ctaKind: "offer_detail",
                            origin: "persisted_offers_panel",
                          },
                        });
                      }}
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
                  {lastSeenAt ? (
                    <span className="text-sm text-muted">
                      Derniere vue le {lastSeenAt}
                    </span>
                  ) : null}
                  <Link
                    href={`/workspace/search/offers/${offer.id}`}
                    onClick={() => {
                      void trackSearchInteraction({
                        type: "SEARCH_RESULT_OPENED",
                        jobOfferId: offer.id,
                        sourceUrl: offer.sourceUrl,
                        offerContext: {
                          title: offer.title,
                          companyName: offer.companyName,
                          locationLabel: offer.locationLabel,
                          matchedQueryLabels: [],
                          matchedKeywords: [],
                        },
                        metadata: {
                          ctaKind: "offer_detail",
                          origin: "persisted_offers_panel",
                        },
                      });
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
                  >
                    Voir le detail
                  </Link>
                  <a
                    href={offer.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      void trackSearchInteraction({
                        type: "SEARCH_RESULT_OPENED",
                        jobOfferId: offer.id,
                        sourceUrl: offer.sourceUrl,
                        offerContext: {
                          title: offer.title,
                          companyName: offer.companyName,
                          locationLabel: offer.locationLabel,
                          matchedQueryLabels: [],
                          matchedKeywords: [],
                        },
                        metadata: {
                          ctaKind: "external_offer",
                          origin: "persisted_offers_panel",
                        },
                      });
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
                  >
                    Ouvrir l offre
                  </a>
                  <DeletePersistedOfferButton
                    offerId={offer.id}
                    offerTitle={offer.title}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {hasLatestMatch ? (
                  <div className="rounded-[1.25rem] border border-line bg-card p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      Dernier match
                    </p>
                    {offer.latestMatchScore !== null ? (
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {offer.latestMatchScore}/100
                      </p>
                    ) : null}
                    {offer.latestRank !== null ? (
                      <p className="mt-1 text-xs text-muted">
                        Rang {offer.latestRank}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {hasLatestSearch ? (
                  <div className="rounded-[1.25rem] border border-line bg-card p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      Derniere recherche
                    </p>
                    {offer.latestSearchLabel ? (
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {offer.latestSearchLabel}
                      </p>
                    ) : null}
                    {latestSearchStatus ? (
                      <p className="mt-1 text-xs text-muted">
                        {latestSearchStatus}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {postedAt ? (
                  <div className="rounded-[1.25rem] border border-line bg-card p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Publiee</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {postedAt}
                    </p>
                  </div>
                ) : null}
                {firstSeenAt ? (
                  <div className="rounded-[1.25rem] border border-line bg-card p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      Premiere apparition
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {firstSeenAt}
                    </p>
                  </div>
                ) : null}
              </div>

              {hasContextCard ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                  {offer.matchExplanation ? (
                    <div className="rounded-[1.25rem] border border-line bg-card p-4">
                      <p className="text-sm font-medium text-foreground">
                        Justification du dernier match
                      </p>
                      <p className="mt-2 text-sm leading-7 text-foreground">
                        {offer.matchExplanation}
                      </p>
                    </div>
                  ) : null}
                  {offer.latestFeedbackNote ? (
                    <div className="rounded-[1.25rem] border border-line bg-card p-4">
                      <p className="text-sm font-medium text-foreground">Retour utilisateur</p>
                      <p className="mt-2 text-sm leading-7 text-foreground">
                        {offer.latestFeedbackNote}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                <OfferFeedbackControls
                  offerId={offer.id}
                  currentDecision={offer.latestFeedbackDecision}
                  currentNote={offer.latestFeedbackNote}
                />
                <OfferDraftGenerator jobOfferId={offer.id} />
              </div>
            </article>
          );
          })}
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
