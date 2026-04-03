"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { SearchDiscoveryResult } from "@/lib/search/types";
import { trackSearchInteraction } from "./search-interactions";

type Props = {
  disabled: boolean;
};

const contractLabels: Record<string, string> = {
  internship: "Stage",
  apprenticeship: "Alternance",
  full_time: "Temps plein",
  part_time: "Temps partiel",
  temporary: "Temporaire",
  freelance: "Freelance",
};

const remoteLabels: Record<string, string> = {
  fulltime: "Remote complet",
  partial: "Hybride",
  punctual: "Teletravail ponctuel",
  no: "Sur site",
};

function formatContractLabel(contractType: string | null) {
  if (!contractType) {
    return null;
  }

  return contractLabels[contractType] ?? contractType;
}

function formatRemoteLabel(remoteMode: string | null) {
  if (!remoteMode) {
    return null;
  }

  return remoteLabels[remoteMode] ?? remoteMode;
}

function formatPublishedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SearchDiscoveryPanel({ disabled }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<SearchDiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const providerSummary = result
    ? result.providers
        .map((provider) => `${provider.label} (${provider.offerCount})`)
        .join(", ")
    : null;
  const languageSummary = result
    ? Array.from(
        new Set(
          result.providers
            .map((provider) => provider.language.trim().toUpperCase())
            .filter(Boolean),
        ),
      ).join(", ")
    : null;

  async function handleSearch() {
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/search/discovery", {
      method: "POST",
    });

    const payload = (await response.json()) as SearchDiscoveryResult & {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible de lancer la recherche");
      setIsLoading(false);
      return;
    }

    setResult(payload);
    router.refresh();
    setIsLoading(false);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <aside className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="space-y-3">
          <p className="app-kicker">
            Execution
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Lancer la collecte publique
          </h2>
          <p className="text-sm leading-7 text-foreground">
            Le bouton lance les variantes affichees plus haut, interroge Welcome to the
            Jungle, LinkedIn, Indeed et la recherche web approfondie, puis deduplique et
            score les offres avant affichage. Les offres persistees affichees plus bas sont
            rechargees apres chaque collecte.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          disabled={disabled || isLoading}
          className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Recherche en cours..." : "Lancer la recherche initiale"}
        </button>

        {result ? (
          <div aria-live="polite" className="text-sm leading-7 text-muted">
            {`${result.offerCount} offre(s) previsualisee(s), ${result.normalizedOffers.length} opportunite(s) normalisee(s) et ${result.persistence?.persistedOfferCount ?? 0} offre(s) persistee(s) apres ${result.executedQueryCount} requete(s).`}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-4 rounded-[1.5rem] border border-line bg-white/70 p-5">
            <div>
              <p className="text-sm text-muted">Resume</p>
              <p className="mt-2 text-sm leading-7 text-foreground">{result.summary}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Plan utilise</p>
              <p className="mt-2 text-sm leading-7 text-foreground">{result.planSummary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {providerSummary ? (
                <div className="surface-muted rounded-[1.25rem] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Sources</p>
                  <p className="mt-2 text-base font-medium text-foreground">{providerSummary}</p>
                </div>
              ) : null}
              {languageSummary ? (
                <div className="surface-muted rounded-[1.25rem] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Langues</p>
                  <p className="mt-2 text-base font-medium text-foreground">{languageSummary}</p>
                </div>
              ) : null}
              <div className="surface-muted rounded-[1.25rem] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Version normalisee</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {result.normalizedOffers.length} opportunite(s)
                </p>
              </div>
              <div className="surface-muted rounded-[1.25rem] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Offres enregistrees</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {result.persistence?.persistedOfferCount ?? 0} offre(s)
                </p>
              </div>
            </div>
            {result.persistence ? (
              <div className="surface-muted rounded-[1.25rem] p-4 text-sm leading-7 text-foreground">
                Run en base: <span className="font-medium">{result.persistence.searchRunId}</span>.
                {` ${result.persistence.createdOfferCount}`} nouvelle(s) offre(s),
                {` ${result.persistence.updatedOfferCount}`} deja vue(s) remise(s) a jour.
              </div>
            ) : null}
            {result.warnings.length > 0 ? (
              <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {result.warnings.join(" ")}
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>

      <div className="space-y-4">
        {result?.offers.length ? (
          result.offers.map((offer) => {
            const contractLabel = formatContractLabel(offer.contractType);
            const remoteLabel = formatRemoteLabel(offer.remoteMode);
            const publishedAtLabel = formatPublishedAt(offer.publishedAt);
            const summaryText = offer.summary ?? offer.profileSnippet;

            return (
              <article
                key={offer.id}
                className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="status-pill status-pill-success">
                        {offer.sourceSite}
                      </span>
                      {contractLabel ? (
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                          {contractLabel}
                        </span>
                      ) : null}
                      {remoteLabel ? (
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                          {remoteLabel}
                        </span>
                      ) : null}
                      <span className="status-pill status-pill-info">
                        Score {offer.relevanceScore}/100
                      </span>
                      <span className="rounded-full border border-[rgba(160,117,106,0.28)] bg-[rgba(160,117,106,0.12)] px-3 py-1 text-xs font-medium text-foreground">
                        Match {offer.matching.score}/100
                      </span>
                      <span className="status-pill status-pill-accent">
                        Priorite {offer.priorityScore}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-foreground">
                        {offer.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted md:text-base">
                        {offer.companyName}
                        {offer.locationLabel ? ` - ${offer.locationLabel}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    {publishedAtLabel ? (
                      <span className="text-sm text-muted">
                        Publiee le {publishedAtLabel}
                      </span>
                    ) : null}
                    <a
                      href={offer.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        void trackSearchInteraction({
                          type: "SEARCH_RESULT_OPENED",
                          sourceUrl: offer.sourceUrl,
                          offerContext: {
                            title: offer.title,
                            companyName: offer.companyName,
                            locationLabel: offer.locationLabel,
                            employmentType: offer.contractType,
                            workMode: offer.remoteMode,
                            matchedQueryLabels: offer.matchedQueryLabels,
                            matchedKeywords: offer.matchedKeywords,
                          },
                          metadata: {
                            ctaKind: "external_offer",
                            origin: "search_discovery_panel",
                          },
                        });
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
                    >
                      Ouvrir l offre
                    </a>
                  </div>
                </div>

                <div className={summaryText ? "mt-5 grid gap-4 xl:grid-cols-[1fr_0.78fr]" : "mt-5"}>
                  {summaryText ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">Resume source</p>
                      <p className="text-sm leading-7 text-foreground">{summaryText}</p>
                    </div>
                  ) : null}
                  <div className="space-y-3 rounded-[1.5rem] border border-line bg-white/70 p-4">
                    <p className="text-sm font-medium text-foreground">Correspondance profil</p>
                    <p className="text-sm leading-7 text-foreground">{offer.matching.summary}</p>
                    {offer.matchedQueryLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {offer.matchedQueryLabels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-foreground"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {offer.matchedKeywords.length > 0 ? (
                      <>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">
                          Mots cles retrouves
                        </p>
                        <p className="text-sm leading-7 text-foreground">
                          {offer.matchedKeywords.join(", ")}
                        </p>
                      </>
                    ) : null}
                    {offer.matching.breakdown.length > 0 ? (
                      <>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">
                          Justification du match
                        </p>
                        <div className="space-y-2">
                          {offer.matching.breakdown.map((item) => (
                            <div key={`${offer.id}-${item.criterion}`} className="rounded-[1rem] border border-line bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">
                                  {item.criterion}
                                </p>
                                <span className="rounded-full border border-line bg-[rgba(180,241,240,0.22)] px-3 py-1 text-xs font-medium text-foreground">
                                  +{item.awarded}/{item.max}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-foreground">
                                {item.reason}
                              </p>
                              {item.matchedTerms.length > 0 ? (
                                <p className="mt-2 text-xs leading-6 text-muted">
                                  {item.matchedTerms.join(", ")}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <article className="rounded-[1.75rem] border border-dashed border-line bg-card/70 p-8 text-sm leading-7 text-muted">
            Lance la recherche pour voir les premieres offres dedupliquees correspondant
            au profil courant.
          </article>
        )}
      </div>
    </section>
  );
}
