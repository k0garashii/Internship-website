"use client";

import { useState } from "react";

import type { ForwardingSourceSnapshot } from "@/lib/email/forwarding";

type Props = {
  initialSnapshot: ForwardingSourceSnapshot;
};

type ProvisioningResponse = ForwardingSourceSnapshot & {
  forwardingSecret?: string;
  error?: string;
};

export function EmailForwardingPanel({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [forwardingSecret, setForwardingSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleProvision() {
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/email/forwarding", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: snapshot.configured ? "rotate_secret" : "provision",
      }),
    });

    const payload = (await response.json()) as ProvisioningResponse;

    if (!response.ok) {
      setError(payload.error ?? "Impossible de provisionner le forwarding");
      setIsLoading(false);
      return;
    }

    setSnapshot(payload);
    setForwardingSecret(payload.forwardingSecret ?? null);
    setIsLoading(false);
  }

  const examplePayload =
    snapshot.source?.forwardingAddress ??
    (snapshot.source
      ? `${snapshot.source.forwardingLocalPart}@forwarding.local`
      : "jobs-xxxxx@forwarding.local");

  return (
    <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <aside className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="space-y-3">
          <p className="app-kicker">
            Forwarding email
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Connecter une boite dediee sans OAuth
          </h2>
          <p className="text-sm leading-7 text-foreground">
            Cette brique cree un point d ingestion serveur, un identifiant de
            forwarding et un secret de webhook. Elle prepare la suite pour brancher
            un provider inbound ou centraliser des alertes sur une adresse dediee.
          </p>
        </div>

        <button
          type="button"
          onClick={handleProvision}
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading
            ? "Provisionnement..."
            : snapshot.configured
              ? "Regenerer le secret"
              : "Configurer le forwarding"}
        </button>

        {error ? (
          <div
            role="alert"
            className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        {snapshot.source ? (
          <div className="space-y-4 rounded-[1.5rem] border border-line bg-white/70 p-5">
            <div>
              <p className="text-sm text-muted">Webhook d ingestion</p>
              <p className="mt-2 break-all text-sm leading-7 text-foreground">
                {snapshot.source.webhookUrl}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Adresse dediee</p>
              <p className="mt-2 break-all text-sm leading-7 text-foreground">
                {snapshot.source.forwardingAddress ??
                  "Aucun domaine configure. Utiliser le webhook avec un provider inbound."}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Emails recus</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {snapshot.source.receivedEmailCount}
              </p>
            </div>
          </div>
        ) : null}

        {forwardingSecret ? (
          <div className="rounded-[1.5rem] border border-amber-300 bg-amber-50 p-5">
            <p className="text-sm font-medium text-amber-950">Secret genere</p>
            <p className="mt-2 break-all font-mono text-xs leading-6 text-amber-900">
              {forwardingSecret}
            </p>
            <p className="mt-3 text-sm leading-7 text-amber-900">
              Ce secret n est visible qu ici apres generation. Conserve-le hors de l app.
            </p>
          </div>
        ) : null}

        <div className="surface-muted space-y-3 rounded-[1.5rem] p-5">
          <p className="text-sm font-medium text-foreground">Regles produit</p>
          <ul className="space-y-3 text-sm leading-7 text-foreground">
            {snapshot.instructions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="space-y-4">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Contrat d intake
          </p>
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-7 text-foreground">
              Le webhook attend un `POST` JSON sur l URL ci-dessus, avec le secret dans
              l en-tete `x-forwarding-secret`. Le destinataire doit correspondre a
              l identifiant de forwarding cree pour cet utilisateur.
            </p>
            <pre className="overflow-x-auto rounded-[1.25rem] border border-[rgba(82,71,101,0.18)] bg-foreground p-4 text-xs leading-6 text-white/90">
{`{
  "envelope": {
    "to": "${examplePayload}",
    "from": "alerts@linkedin.com",
    "messageId": "<msg-123@example.com>",
    "receivedAt": "2026-03-19T14:00:00.000Z"
  },
  "message": {
    "subject": "New internship matches for backend engineer",
    "text": "A new role may match your profile: https://company.example/jobs/123",
    "snippet": "A new role may match your profile"
  },
  "metadata": {
    "provider": "cloudmailin"
  }
}`}
            </pre>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Pipeline recu
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                Emails ingestes recemment
              </h3>
            </div>
            {snapshot.source ? (
              <div className="rounded-full border border-line bg-white px-4 py-2 text-sm text-foreground">
                {snapshot.source.receivedEmailCount} message(s)
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.recentEmails.length > 0 ? (
              snapshot.recentEmails.map((email) => (
                <article
                  key={email.id}
                  className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {email.subject ?? "Sans sujet"}
                      </p>
                      <p className="text-sm text-muted">
                        {email.fromName ?? email.fromEmail ?? "Expediteur inconnu"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {email.signal}
                      </span>
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {email.processingStatus}
                      </span>
                    </div>
                  </div>
                  {email.snippet ? (
                    <p className="mt-3 text-sm leading-7 text-foreground">{email.snippet}</p>
                  ) : null}
                  <div className="surface-muted mt-4 rounded-[1rem] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                      Projection pipeline
                    </p>
                    <p className="mt-2 text-sm leading-7 text-foreground">
                      {email.parsingSummary}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {email.parsingNotes.map((note) => (
                        <span
                          key={`${email.id}-${note}`}
                          className="rounded-full border border-line bg-white px-3 py-1 text-xs text-foreground"
                        >
                          {note}
                        </span>
                      ))}
                    </div>

                    {email.normalizedOpportunity ? (
                      <div className="mt-4 rounded-[1rem] border border-line bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {email.normalizedOpportunity.title ?? "Opportunite sans titre deduit"}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                              {email.normalizedOpportunity.companyName ?? "Entreprise a confirmer"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                              {email.normalizedOpportunity.sourceLabel}
                            </span>
                            <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                              {email.normalizedOpportunity.sourceKind}
                            </span>
                          </div>
                        </div>
                        {email.normalizedOpportunity.description ? (
                          <p className="mt-3 text-sm leading-7 text-foreground">
                            {email.normalizedOpportunity.description}
                          </p>
                        ) : null}
                        {email.normalizedOpportunity.sourceUrl ? (
                          <a
                            href={email.normalizedOpportunity.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
                          >
                            Ouvrir la source de l opportunite
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted">
                    {new Date(email.receivedAt).toLocaleString("fr-FR")}
                  </p>
                  {email.canonicalUrl ? (
                    <a
                      href={email.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
                    >
                      Ouvrir le lien detecte
                    </a>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-line bg-white/70 p-5 text-sm leading-7 text-muted">
                Aucun email ingere pour le moment. Provisionne d abord le forwarding,
                puis pousse un premier evenement entrant.
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
