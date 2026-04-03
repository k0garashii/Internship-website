import Link from "next/link";

import { getCurrentViewer } from "@/lib/auth/session";
import { logServiceError } from "@/lib/observability/error-logging";
import {
  companyOffersPageParamsSchema,
  fetchCompanyCareerOffers,
} from "@/lib/company-targets/offers";
import { buildSignalsFromCompanyTarget, recordSearchBehaviorEvent } from "@/server/application/personalization/search-behavior-service";
import { TrackedSearchLink } from "../../_components/tracked-search-link";

type Props = {
  params: Promise<{
    companySlug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pickSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
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

export default async function CompanyOffersPage({ params, searchParams }: Props) {
  const { companySlug } = await params;
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const parsed = companyOffersPageParamsSchema.safeParse({
    companyName: pickSearchParam(resolvedSearchParams, "companyName"),
    websiteUrl: pickSearchParam(resolvedSearchParams, "websiteUrl"),
    careerPageUrl: pickSearchParam(resolvedSearchParams, "careerPageUrl"),
    atsProvider: pickSearchParam(resolvedSearchParams, "atsProvider"),
    discoveryMethod: pickSearchParam(resolvedSearchParams, "discoveryMethod"),
  });

  if (!parsed.success) {
    return (
      <main className="flex min-h-full flex-col gap-8">
        <section className="app-hero p-6 md:p-8">
          <p className="app-kicker">Offres par entreprise</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Impossible d ouvrir cette entreprise.
          </h1>
          <p className="app-copy mt-4 max-w-3xl">
            Les informations minimales de source carriere sont absentes. Reviens sur
            la collecte d offres puis relance la decouverte des pages carrieres / ATS.
          </p>
          <div className="mt-6">
            <Link href="/workspace/search" className="back-link">
              Retour a la collecte d offres
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const result = await fetchCompanyCareerOffers(parsed.data);

  try {
    const baseSignals = buildSignalsFromCompanyTarget({
      companyName: result.companyName,
      companySlug,
      atsProvider: result.atsProvider,
    });

    await recordSearchBehaviorEvent(viewer, {
        type: "COMPANY_TARGET_OPENED",
        companyName: result.companyName,
        companySlug,
        sourceUrl: result.websiteUrl ?? result.careerPageUrl ?? null,
      signals: baseSignals,
      metadata: {
        offerCount: result.offers.length,
      },
      refreshInference: false,
    });

    if (result.atsProvider || result.careerPageUrl) {
      await recordSearchBehaviorEvent(viewer, {
        type: "ATS_SOURCE_OPENED",
        companyName: result.companyName,
        companySlug,
        sourceUrl: result.careerPageUrl ?? result.websiteUrl ?? null,
        signals: baseSignals,
        metadata: {
          atsProvider: result.atsProvider ?? null,
          discoveryMethod: result.discoveryMethod ?? null,
        },
      });
    }
  } catch (error) {
    logServiceError({
      level: "warn",
      scope: "personalization/company-offers-page",
      message: "Unable to record company page behavior event",
      error,
      metadata: {
        userId: viewer.userId,
        companyName: result.companyName,
      },
    });
  }

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <p className="app-kicker">Offres par entreprise</p>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              {result.companyName}
            </h1>
            <p className="app-copy max-w-4xl">{result.sourceSummary}</p>
            <p className="text-sm leading-7 text-muted">{result.summary}</p>
            <div className="status-row">
              <div className="status-pill">
                {result.atsProvider ? result.atsProvider : "Lecture directe du site"}
              </div>
              {result.discoveryMethod ? (
                <div className="status-pill status-pill-info">
                  Source detectee: {result.discoveryMethod}
                </div>
              ) : null}
              <div className="status-pill status-pill-success">
                {result.offers.length} offre(s)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/workspace/search" className="back-link">
              Retour a la collecte d offres
            </Link>
            {result.websiteUrl ? (
              <TrackedSearchLink
                href={result.websiteUrl}
                target="_blank"
                rel="noreferrer"
                interaction={{
                  type: "COMPANY_TARGET_OPENED",
                  companyName: result.companyName,
                  companySlug,
                  sourceUrl: result.websiteUrl,
                  companyContext: {
                    companyName: result.companyName,
                    companySlug,
                    atsProvider: result.atsProvider,
                  },
                  metadata: {
                    ctaKind: "official_site",
                    origin: "company_offers_page",
                  },
                }}
                className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
              >
                Site officiel
              </TrackedSearchLink>
            ) : null}
            {result.careerPageUrl ? (
              <TrackedSearchLink
                href={result.careerPageUrl}
                target="_blank"
                rel="noreferrer"
                interaction={{
                  type: "ATS_SOURCE_OPENED",
                  companyName: result.companyName,
                  companySlug,
                  sourceUrl: result.careerPageUrl,
                  companyContext: {
                    companyName: result.companyName,
                    companySlug,
                    atsProvider: result.atsProvider,
                  },
                  metadata: {
                    ctaKind: "career_page",
                    origin: "company_offers_page",
                  },
                }}
                className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
              >
                Ouvrir la page carriere
              </TrackedSearchLink>
            ) : null}
          </div>
        </div>
      </section>

      {result.warnings.length > 0 ? (
        <section className="rounded-[1.75rem] border border-[rgba(160,117,106,0.28)] bg-[rgba(160,117,106,0.12)] px-5 py-4 text-sm text-foreground">
          {result.warnings.join(" ")}
        </section>
      ) : null}

      {result.offers.length > 0 ? (
        <section className="grid gap-4">
          {result.offers.map((offer) => (
            <article
              key={offer.id}
              className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="status-pill status-pill-info">{offer.sourceLabel}</span>
                    {offer.locationLabel ? (
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {offer.locationLabel}
                      </span>
                    ) : null}
                    {offer.department ? (
                      <span className="status-pill status-pill-accent">{offer.department}</span>
                    ) : null}
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {offer.title}
                    </h2>
                    {formatPublishedAt(offer.publishedAt) ? (
                      <p className="mt-2 text-sm text-muted">
                        Publication: {formatPublishedAt(offer.publishedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <TrackedSearchLink
                  href={offer.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  interaction={{
                    type: "SEARCH_RESULT_OPENED",
                    sourceUrl: offer.sourceUrl,
                    companyName: result.companyName,
                    offerContext: {
                      title: offer.title,
                      companyName: result.companyName,
                      locationLabel: offer.locationLabel,
                      matchedQueryLabels: [result.companyName],
                      matchedKeywords: [],
                    },
                    metadata: {
                      ctaKind: "company_career_offer",
                      origin: "company_offers_page",
                    },
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
                >
                  Ouvrir l annonce
                </TrackedSearchLink>
              </div>

              {offer.description ? (
                <div className="mt-5 rounded-[1.25rem] border border-line bg-white/70 p-4">
                  <p className="text-sm font-medium text-foreground">Description</p>
                  <p className="mt-2 text-sm leading-7 text-foreground">
                    {offer.description}
                  </p>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-line bg-card/70 p-8 text-sm leading-7 text-muted">
          Aucune offre n a pu etre extraite depuis cette source pour le moment. Le plus
          frequent est un portail de recrutement tres dynamique ou une page carriere sans liste
          directement accessible au HTML public.
        </section>
      )}
    </main>
  );
}
