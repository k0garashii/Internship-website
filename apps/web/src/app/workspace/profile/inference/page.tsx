import Link from "next/link";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  getSearchBehaviorEventLabel,
  searchBehaviorEventTypes,
  type SearchBehaviorEventType,
} from "@/lib/profile/personalization-signals";
import { getSearchPersonalizationSnapshot } from "@/server/application/personalization/profile-inference-service";

function labelFromMode(mode: string) {
  switch (mode) {
    case "LOCK_EXPLICIT":
      return "Verrou explicite";
    case "BOOST_ONLY":
      return "Renfort seulement";
    case "ALLOW_EXPLORATION":
      return "Exploration autorisee";
    case "REQUIRES_CONFIRMATION":
      return "Confirmation necessaire";
    case "NEGATIVE_ONLY_WITH_STRONG_SIGNAL":
      return "Negatif sous signal fort";
    default:
      return mode;
  }
}

function labelFromAxis(axis: string) {
  switch (axis) {
    case "ROLE":
      return "Role";
    case "DOMAIN":
      return "Domaine";
    case "KEYWORD":
      return "Mot-cle";
    case "TECHNOLOGY":
      return "Technologie";
    case "LOCATION":
      return "Lieu";
    case "WORK_MODE":
      return "Mode de travail";
    case "EMPLOYMENT_TYPE":
      return "Type de contrat";
    case "COMPANY":
      return "Entreprise";
    case "COMPANY_TYPE":
      return "Type d entreprise";
    case "OUTCOME":
      return "Resultat";
    default:
      return axis;
  }
}

function labelFromConfidence(confidence: string) {
  switch (confidence) {
    case "HIGH":
      return "Confiance forte";
    case "MEDIUM":
      return "Confiance moyenne";
    case "LOW":
      return "Confiance prudente";
    default:
      return confidence;
  }
}

function labelFromPolarity(polarity: string) {
  return polarity === "NEGATIVE" ? "A ecarter" : "Renforce";
}

function polarityClass(polarity: string) {
  return polarity === "NEGATIVE"
    ? "status-pill status-pill-accent"
    : "status-pill status-pill-success";
}

function confidenceClass(confidence: string) {
  switch (confidence) {
    case "HIGH":
      return "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800";
    case "MEDIUM":
      return "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800";
    case "LOW":
    default:
      return "rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground";
  }
}

function isSearchBehaviorEventType(value: string): value is SearchBehaviorEventType {
  return searchBehaviorEventTypes.some((eventType) => eventType === value);
}

function labelFromEventType(value: string) {
  return isSearchBehaviorEventType(value) ? getSearchBehaviorEventLabel(value) : value;
}

function formatDate(value: string | null) {
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

function formatPointDelta(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded} pt${Math.abs(rounded) > 1 ? "s" : ""}`;
}

function formatPercentage(value: number | null) {
  if (value === null) {
    return null;
  }

  return `${Math.round(value * 100)} %`;
}

function formatPercentagePointDelta(value: number | null) {
  if (value === null) {
    return null;
  }

  const percentagePoints = Math.round(value * 100);
  const prefix = percentagePoints > 0 ? "+" : "";

  return `${prefix}${percentagePoints} pts`;
}

function formatPreferenceIntensity(rawScore: number) {
  const intensity = Math.round((1 - Math.exp(-Math.abs(rawScore) / 4.5)) * 100);
  return Math.min(Math.max(intensity, 1), 99);
}

export default async function InferenceProfilePage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const personalization = await getSearchPersonalizationSnapshot(
    viewer.userId,
    viewer.workspaceId,
  );
  const snapshot = personalization.snapshot;
  const diagnostics = personalization.diagnostics;

  if (!snapshot || !diagnostics) {
    return (
      <main className="flex min-h-full flex-col gap-8">
        <section className="app-hero p-6 md:p-8">
          <p className="app-kicker">Profil implicite</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Aucun signal implicite exploitable pour le moment.
          </h1>
          <p className="app-copy mt-4 max-w-3xl">
            Lance quelques recherches, ouvre des offres et donne du feedback pour que
            l application commence a apprendre ce qui te correspond.
          </p>
          <div className="mt-6">
            <Link href="/workspace/search" className="back-link">
              Retour a la recherche
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const negativePreferenceCount = snapshot.inferred.filter(
    (preference) => preference.polarity === "NEGATIVE",
  ).length;
  const explicitNegativeSignalCount =
    (diagnostics.eventTypeCounts.OFFER_FEEDBACK_NOT_RELEVANT ?? 0) +
    (diagnostics.eventTypeCounts.OFFER_DELETED ?? 0) +
    (diagnostics.eventTypeCounts.REJECTION_RECORDED ?? 0);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="app-kicker">Profil implicite</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Ce que l application apprend de ta recherche.
            </h1>
            <p className="app-copy mt-4 max-w-4xl">
              Cette vue reste diagnostique: le profil declare garde la main, et les
              signaux implicites servent surtout a mieux classer les offres.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/workspace/profile" className="back-link">
              Retour au profil
            </Link>
            <Link
              href="/workspace/search"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Continuer la recherche
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Signaux observes
          </p>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {diagnostics.eventCount}
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Preferences inferees
          </p>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {snapshot.inferred.length}
          </p>
        </article>
        {formatDate(personalization.lastComputedAt) ? (
          <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Derniere mise a jour
            </p>
            <p className="mt-3 text-sm leading-7 text-foreground">
              {formatDate(personalization.lastComputedAt)}
            </p>
          </article>
        ) : null}
        <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Gain moyen
          </p>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {formatPointDelta(diagnostics.impact.averageScoreDelta)}
          </p>
        </article>
      </section>

      {/* These cards explain attention and convergence, not raw engine counters. */}
      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Lectures approfondies
          </p>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {diagnostics.implicitSignalSummary.dwellQualifiedOpenCount}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Offres ouvertes puis lues assez longtemps pour signaler un vrai interet.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Entreprises explorees
          </p>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {diagnostics.implicitSignalSummary.companyExplorationCount}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Ouvertures d entreprises cibles ou de leur portail carriere.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Progression des meilleures offres
          </p>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {formatPointDelta(diagnostics.convergence.averageTopScoreDelta)}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Evolution moyenne des 5 meilleures offres entre les premiers et derniers runs comparables.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-5 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Recherches comparees
          </p>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {diagnostics.convergence.evaluatedRunCount}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Nombre de recherches reutilisables pour mesurer une tendance.
          </p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Impact mesure sur les offres
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Comparaisons</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {diagnostics.impact.comparedOfferCount}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">
                Offres mieux classees
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {diagnostics.impact.personalizedWins}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Classement stable</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {diagnostics.impact.unchangedCount}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-[1.25rem] border border-line bg-white/70 p-4 text-sm leading-7 text-foreground">
            {diagnostics.convergence.firstRunAverageTopScore !== null ? (
              <p>
                Premier run comparable: {diagnostics.convergence.firstRunAverageTopScore} /100.
              </p>
            ) : null}
            {diagnostics.convergence.latestRunAverageTopScore !== null ? (
              <p>
                Dernier run comparable: {diagnostics.convergence.latestRunAverageTopScore} /100.
              </p>
            ) : null}
            {diagnostics.convergence.relevantShareDelta !== null ? (
              <p>
                Evolution de la part d offres bien alignees:{" "}
                {formatPercentagePointDelta(diagnostics.convergence.relevantShareDelta)}.
              </p>
            ) : (
              <p>Pas encore assez de runs pour mesurer la part d offres bien alignees.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Preferences inferees
          </p>
          {negativePreferenceCount === 0 && explicitNegativeSignalCount === 0 ? (
            <div className="mt-6 rounded-[1.25rem] border border-amber-200 bg-amber-50/80 p-4 text-sm leading-7 text-amber-900">
              Aucun signal negatif explicite n a encore ete observe. Tant que tu n utilises
              pas de feedback &quot;non pertinente&quot;, de suppression d offre ou d issue negative,
              l inference restera surtout positive.
            </div>
          ) : null}
          <div className="mt-6 space-y-3">
            {snapshot.inferred.length > 0 ? (
              snapshot.inferred.map((preference) => (
                <div
                  key={`${preference.axis}-${preference.value}-${preference.polarity}`}
                  className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="status-pill">{labelFromAxis(preference.axis)}</span>
                    <span className={polarityClass(preference.polarity)}>
                      {labelFromPolarity(preference.polarity)}
                    </span>
                    <span className={confidenceClass(preference.confidence)}>
                      {labelFromConfidence(preference.confidence)}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-medium text-foreground">{preference.value}</p>
                  <p className="mt-1 text-sm text-muted">
                    Intensite {formatPreferenceIntensity(preference.score)}/100 -{" "}
                    {preference.supportingEventCount} signal(aux) utile(s)
                  </p>
                  {preference.lastObservedAt ? (
                    <p className="mt-1 text-sm text-muted">
                      Dernier signal: {formatDate(preference.lastObservedAt)}
                    </p>
                  ) : null}
                  {preference.reason ? (
                    <p className="mt-2 text-sm leading-7 text-foreground">{preference.reason}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-muted">
                Aucune preference inferee n est disponible.
              </p>
            )}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Garde-fous
            </p>
            <div className="mt-6 space-y-3">
              {snapshot.guardrails.map((guardrail) => (
                <div
                  key={`${guardrail.axis}-${guardrail.mode}`}
                  className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                >
                  <p className="text-sm font-medium text-foreground">
                    {labelFromAxis(guardrail.axis)}
                  </p>
                  <p className="mt-1 text-sm text-muted">{labelFromMode(guardrail.mode)}</p>
                  <p className="mt-2 text-sm leading-7 text-foreground">
                    {guardrail.rationale}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Signaux les plus frequents
            </p>
            <div className="mt-6 space-y-3">
              {Object.entries(diagnostics.eventTypeCounts).length > 0 ? (
                Object.entries(diagnostics.eventTypeCounts)
                  .sort((left, right) => right[1] - left[1])
                  .slice(0, 8)
                  .map(([eventType, count]) => (
                    <div
                      key={eventType}
                      className="flex items-center justify-between rounded-[1.25rem] border border-line bg-white/70 px-4 py-3"
                    >
                      <p className="text-sm text-foreground">{labelFromEventType(eventType)}</p>
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {count}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="text-sm leading-7 text-muted">
                  Aucun signal dominant pour le moment.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Tendance recente
            </p>
            <div className="mt-6 space-y-3">
              {diagnostics.convergence.recentRuns.length > 0 ? (
                diagnostics.convergence.recentRuns.map((run) => (
                  <div
                    key={run.runId}
                    className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{run.label}</p>
                      {run.averageTopScore !== null ? (
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                          {run.averageTopScore}/100
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                      {formatDate(run.createdAt) ? `${formatDate(run.createdAt)} - ` : ""}
                      {run.resultCount} offre(s)
                    </p>
                    {run.relevantShare !== null ? (
                      <p className="mt-2 text-sm leading-7 text-foreground">
                        Part d offres bien alignees: {formatPercentage(run.relevantShare)}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-muted">
                  Pas encore assez de recherches comparees pour suivre une tendance.
                </p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
