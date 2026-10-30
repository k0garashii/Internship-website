"use client";

import { useState } from "react";

import type {
  GmailConnectionSnapshot,
  GmailSyncResult,
} from "@/lib/email/mailbox-sync";

type Props = {
  initialSnapshot: GmailConnectionSnapshot;
};

function getConnectionStateLabel(snapshot: GmailConnectionSnapshot) {
  if (!snapshot.source) {
    return "Non connecté";
  }

  if (snapshot.source.status === "ERROR") {
    return "Connecté, synchro en erreur";
  }

  if (snapshot.source.status === "DISABLED") {
    return "Connexion désactivée";
  }

  if (snapshot.configured) {
    return "Connecte";
  }

  return "Connecté, autorisations à compléter";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Jamais";
  }

  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReplyStatusLabel(status: GmailConnectionSnapshot["detectedReplies"][number]["status"]) {
  switch (status) {
    case "OUTBOUND_ONLY":
      return "Sortant détecté";
    case "RESPONSE_RECEIVED":
      return "Réponse reçue";
    case "INTERVIEW":
      return "Entretien probable";
    case "REJECTION":
      return "Refus probable";
    case "OFFER":
      return "Offre probable";
    default:
      return status;
  }
}

export function GmailMailboxPanel({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setError(null);
    setMessage(null);
    setIsSyncing(true);

    const response = await fetch("/api/email/google/sync", {
      method: "POST",
    });

    const payload = (await response.json()) as GmailSyncResult & {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible de synchroniser Gmail");
      setIsSyncing(false);
      return;
    }

    setSnapshot(payload.snapshot);
    setMessage(
      `${payload.processedMessageCount} message(s) lus, ${payload.filteredOutMessageCount} ecarte(s), ${payload.detectedReplyCount} signal(aux) de reponse recalcules.`,
    );
    setIsSyncing(false);
  }

  const source = snapshot.source;

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <aside className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="space-y-3">
          <p className="app-kicker">Connexion Gmail</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Lire la boîte pour suivre les candidatures réelles.
          </h2>
          <p className="text-sm leading-7 text-foreground">
            Cette connexion sert à relire les messages reçus et envoyés dans Gmail afin
            de détecter les fils de candidature, même si le mail initial n’a pas été
            envoyé depuis l’application.
          </p>
        </div>

        {message ? (
          <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!source ? (
            <a
              href="/api/email/google/connect?scopeSet=mailbox&redirectTo=%2Fworkspace"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Connecter Gmail
            </a>
          ) : null}
          {source ? (
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing ? "Synchronisation..." : "Synchroniser Gmail"}
            </button>
          ) : null}
        </div>

        {source ? (
          <div className="rounded-[1rem] border border-line bg-white/70 px-4 py-4 text-sm leading-7 text-foreground">
            {source.hasSendScope
              ? "Les autorisations Gmail sont complètes. Cette page garde maintenant la synchro et la lecture des fils utiles."
              : "L’activation brouillons et envoi se fait maintenant sur la page précédente, juste après la connexion Gmail."}
          </div>
        ) : null}
      </aside>

      <div className="space-y-4">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Messages récents
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                Ce qui a été indexé dans la boîte.
              </h3>
            </div>
            {source ? (
              <div className="rounded-full border border-line bg-white px-4 py-2 text-sm text-foreground">
                {source.messageCount} message(s)
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.recentMessages.length > 0 ? (
              snapshot.recentMessages.map((message) => (
                <article
                  key={message.id}
                  className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {message.subject ?? "Sans sujet"}
                      </p>
                      <p className="text-sm text-muted">
                        {message.direction === "OUTBOUND" ? "Sortant vers" : "Reçu de"}{" "}
                        {message.direction === "OUTBOUND"
                          ? message.toEmails[0] ?? "destinataire inconnu"
                          : message.fromEmail ?? "expéditeur inconnu"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {message.direction}
                      </span>
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {message.signal}
                      </span>
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {message.processingStatus}
                      </span>
                    </div>
                  </div>
                  {message.snippet ? (
                    <p className="mt-3 text-sm leading-7 text-foreground">{message.snippet}</p>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted">
                    {formatDateTime(message.receivedAt ?? message.sentAt)}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-line bg-white/70 p-5 text-sm leading-7 text-muted">
                Aucun message Gmail n’est encore synchronisé.
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
