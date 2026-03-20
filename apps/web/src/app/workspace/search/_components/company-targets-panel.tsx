"use client";

import { useState } from "react";

import type { CareerSourceDiscoveryResult } from "@/lib/company-targets/discovery";
import type { CompanyTargetSuggestionResult } from "@/lib/company-targets/suggestions";

type Props = {
  disabled: boolean;
};

export function CompanyTargetsPanel({ disabled }: Props) {
  const [result, setResult] = useState<CompanyTargetSuggestionResult | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<CareerSourceDiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  async function handleGenerateTargets() {
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/profile/company-targets", {
      method: "POST",
    });

    const payload = (await response.json()) as CompanyTargetSuggestionResult & {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible de generer une liste d entreprises cibles");
      setIsLoading(false);
      return;
    }

    setResult(payload);
    setDiscoveryResult(null);
    setDiscoveryError(null);
    setIsLoading(false);
  }

  async function handleDiscoverCareerSources() {
    if (!result) {
      return;
    }

    setDiscoveryError(null);
    setIsDiscovering(true);

    const response = await fetch("/api/profile/company-targets/discovery", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        targets: result.suggestions,
      }),
    });

    const payload = (await response.json()) as CareerSourceDiscoveryResult & {
      error?: string;
    };

    if (!response.ok) {
      setDiscoveryError(payload.error ?? "Impossible de decouvrir les pages carrieres");
      setIsDiscovering(false);
      return;
    }

    setDiscoveryResult(payload);
    setIsDiscovering(false);
  }

  const discoveryIndex = new Map(
    (discoveryResult?.results ?? []).map((item) => [item.companyName, item]),
  );

  return (
    <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <aside className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="space-y-3">
          <p className="app-kicker">
            Entreprises cibles
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Identifier les employeurs a prioriser
          </h2>
          <p className="text-sm leading-7 text-foreground">
            Cette etape transforme le profil en hypotheses d entreprises a investiguer.
            Elle sert a orienter la suite vers les sites carrieres proprietaires et les
            ATS avant de se limiter aux job boards.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateTargets}
          disabled={disabled || isLoading}
          className="inline-flex w-full items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Generation..." : "Generer des entreprises cibles"}
        </button>

        <div aria-live="polite" className="text-sm leading-7 text-muted">
          {result
            ? `${result.suggestions.length} entreprise(s) cible(s) proposee(s).`
            : "Aucune suggestion chargee pour le moment."}
        </div>

        <button
          type="button"
          onClick={handleDiscoverCareerSources}
          disabled={disabled || isLoading || isDiscovering || !result}
          className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDiscovering ? "Decouverte en cours..." : "Decouvrir les pages carrieres / ATS"}
        </button>

        {error ? (
          <div
            role="alert"
            className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        {discoveryError ? (
          <div
            role="alert"
            className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {discoveryError}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-4 rounded-[1.5rem] border border-line bg-white/70 p-5">
            <div>
              <p className="text-sm text-muted">Resume</p>
              <p className="mt-2 text-sm leading-7 text-foreground">{result.summary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface-muted rounded-[1.25rem] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Provider</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {result.provider === "gemini" ? "Gemini" : "Heuristique locale"}
                </p>
              </div>
              <div className="surface-muted rounded-[1.25rem] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Usage</p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Prochaine etape: decouvrir les pages carrieres et ATS de ces entreprises.
                </p>
              </div>
            </div>
            {discoveryResult ? (
              <div>
                <p className="text-sm text-muted">Decouverte</p>
                <p className="mt-2 text-sm leading-7 text-foreground">
                  {discoveryResult.summary}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>

      <div className="space-y-4">
        {result?.suggestions.length ? (
          result.suggestions.map((suggestion) => {
            const discovery = discoveryIndex.get(suggestion.companyName);

            return (
              <article
                key={suggestion.companyName}
                className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {suggestion.tags.map((tag) => (
                      <span
                        key={tag}
                        className="status-pill status-pill-info"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                      {suggestion.companyName}
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      Priorite suggeree: {suggestion.priority}/100
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {suggestion.websiteUrl ? (
                    <a
                      href={suggestion.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
                    >
                      Site officiel
                    </a>
                  ) : null}
                  {suggestion.careerPageUrl ? (
                    <a
                      href={suggestion.careerPageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
                    >
                      Page carriere
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.78fr]">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Pourquoi cette entreprise</p>
                  <p className="text-sm leading-7 text-foreground">{suggestion.rationale}</p>
                  {suggestion.notes ? (
                    <p className="text-sm leading-7 text-muted">{suggestion.notes}</p>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-[1.5rem] border border-line bg-white/70 p-4">
                  <p className="text-sm font-medium text-foreground">Signaux detectes</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.matchedSignals.length > 0 ? (
                      suggestion.matchedSignals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-foreground"
                        >
                          {signal}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted">
                        Aucun signal fort retourne, suggestion generaliste.
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {discovery ? (
                <div className="mt-6 rounded-[1.5rem] border border-line bg-white/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Decouverte carriere
                      </p>
                      <p className="mt-2 text-sm leading-7 text-foreground">
                        {discovery.notes ??
                          "Resultat de la detection automatique depuis le site officiel."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={
                          discovery.status === "found"
                            ? "status-pill status-pill-success"
                            : discovery.status === "error"
                              ? "rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-800"
                              : "rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
                        }
                      >
                        {discovery.status === "found"
                          ? "Point d entree detecte"
                          : discovery.status === "error"
                            ? "Erreur de detection"
                            : "Non detecte"}
                      </span>
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {discovery.discoveryMethod}
                      </span>
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        confiance {discovery.confidence}
                      </span>
                      {discovery.atsProvider ? (
                        <span className="status-pill status-pill-accent">
                          ATS {discovery.atsProvider}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {discovery.careerPageUrl ? (
                    <div className="mt-4">
                      <a
                        href={discovery.careerPageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
                      >
                        Ouvrir le point d entree carriere
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : null}
              </article>
            );
          })
        ) : (
          <article className="rounded-[1.75rem] border border-dashed border-line bg-card/70 p-8 text-sm leading-7 text-muted">
            Genere une premiere liste d entreprises cibles pour orienter la suite de la
            collecte vers les bons employeurs et leurs vraies sources.
          </article>
        )}
      </div>
    </section>
  );
}
