"use client";

import { useState } from "react";

import type { SearchDiscoveryResult } from "@/lib/search/types";

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
    return "Non precise";
  }

  return contractLabels[contractType] ?? contractType;
}

function formatRemoteLabel(remoteMode: string | null) {
  if (!remoteMode) {
    return "Non precise";
  }

  return remoteLabels[remoteMode] ?? remoteMode;
}

function formatPublishedAt(value: string | null) {
  if (!value) {
    return "Date inconnue";
  }

  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SearchDiscoveryPanel({ disabled }: Props) {
  const [result, setResult] = useState<SearchDiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(false);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <aside className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Execution
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Lancer la collecte publique
          </h2>
          <p className="text-sm leading-7 text-foreground">
            Le bouton lance les variantes affichees plus haut, interroge Welcome to the
            Jungle, puis deduplique et score les offres avant affichage.
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

        <div aria-live="polite" className="text-sm leading-7 text-muted">
          {result
            ? `${result.offerCount} offre(s) previsualisee(s), ${result.normalizedOffers.length} opportunite(s) normalisee(s) apres ${result.executedQueryCount} requete(s).`
            : "Aucune collecte n a encore ete lancee sur cette session."}
        </div>

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
              <div className="rounded-[1.25rem] border border-line bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Source</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {result.providers[0]?.label ?? "Inconnue"}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-line bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Langue index</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {(result.providers[0]?.language ?? "n/a").toUpperCase()}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-line bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Format commun</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {result.normalizedOffers.length} opportunite(s)
                </p>
              </div>
            </div>
            {result.queryExecutions.length > 0 ? (
              <div>
                <p className="text-sm text-muted">Requetes executees</p>
                <div className="mt-3 space-y-3">
                  {result.queryExecutions.map((execution) => (
                    <div
                      key={execution.id}
                      className="rounded-[1.25rem] border border-line bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{execution.label}</p>
                        <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground">
                          {execution.returnedHits} / {execution.totalHits} hit(s)
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-[1rem] border border-line bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                            Role
                          </p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {execution.targetRole}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-line bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                            Domaine
                          </p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {execution.domain ?? "Sans filtre domaine"}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-line bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                            Zone
                          </p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {execution.location ?? "Aucune precision"}
                          </p>
                        </div>
                      </div>
                      {execution.focusKeywords.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {execution.focusKeywords.map((keyword) => (
                            <span
                              key={`${execution.id}-${keyword}`}
                              className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                        Langue {(execution.language ?? "n/a").toUpperCase()} / source{" "}
                        {execution.providerLabel}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-foreground">
                        Requete utilisee:{" "}
                        <span className="font-medium">{execution.queryText}</span>
                      </p>
                      {execution.queryText !== execution.requestedQueryText ? (
                        <p className="text-xs leading-6 text-muted">
                          Variante initiale simplifiee apres echec de la requete complete.
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
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
          result.offers.map((offer) => (
            <article
              key={offer.id}
              className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
                      {offer.sourceSite}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {formatContractLabel(offer.contractType)}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {formatRemoteLabel(offer.remoteMode)}
                    </span>
                    <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900">
                      Score {offer.relevanceScore}/100
                    </span>
                    <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                      {offer.relevanceLabel}
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
                  <span className="text-sm text-muted">
                    Publiee le {formatPublishedAt(offer.publishedAt)}
                  </span>
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

              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.78fr]">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Resume source</p>
                  <p className="text-sm leading-7 text-foreground">
                    {offer.summary ?? offer.profileSnippet ?? "Aucun resume texte exploitable."}
                  </p>
                </div>
                <div className="space-y-3 rounded-[1.5rem] border border-line bg-white/70 p-4">
                  <p className="text-sm font-medium text-foreground">Correspondance profil</p>
                  <div className="flex flex-wrap gap-2">
                    {offer.matchedQueryLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-foreground"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">
                    Mots cles retrouves
                  </p>
                  <p className="text-sm leading-7 text-foreground">
                    {offer.matchedKeywords.length > 0
                      ? offer.matchedKeywords.join(", ")
                      : "Aucune occurrence forte parmi les mots cles sauvegardes."}
                  </p>
                </div>
              </div>
            </article>
          ))
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
