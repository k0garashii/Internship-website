"use client";

import Link from "next/link";
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
    return "Non connecte";
  }

  if (snapshot.source.status === "ERROR") {
    return "Connecte, synchro en erreur";
  }

  if (snapshot.source.status === "DISABLED") {
    return "Connexion desactivee";
  }

  if (snapshot.configured) {
    return "Connecte";
  }

  return "Connecte, autorisations a completer";
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
      return "Sortant detecte";
    case "RESPONSE_RECEIVED":
      return "Reponse recue";
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
  const [syncQuery, setSyncQuery] = useState(initialSnapshot.source?.syncQuery ?? "");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveSettings() {
    setError(null);
    setMessage(null);
    setIsSaving(true);

    const response = await fetch("/api/email/google/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        syncQuery,
      }),
    });

    const payload = (await response.json()) as GmailConnectionSnapshot & {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible de mettre a jour la requete Gmail");
      setIsSaving(false);
      return;
    }

    setSnapshot(payload);
    setSyncQuery(payload.source?.syncQuery ?? "");
    setMessage("Filtre Gmail mis a jour.");
    setIsSaving(false);
  }

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
    setSyncQuery(payload.snapshot.source?.syncQuery ?? "");
    setMessage(
      `${payload.processedMessageCount} message(s) lus, ${payload.filteredOutMessageCount} ecarte(s), ${payload.detectedReplyCount} signal(aux) de reponse recalcules.`,
    );
    setIsSyncing(false);
  }

  async function handleDisconnect() {
    setError(null);
    setMessage(null);
    setIsDisconnecting(true);

    const response = await fetch("/api/email/google/disconnect", {
      method: "POST",
    });

    const payload = (await response.json()) as GmailConnectionSnapshot & {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible de deconnecter Gmail");
      setIsDisconnecting(false);
      return;
    }

    setSnapshot(payload);
    setSyncQuery(payload.source?.syncQuery ?? "");
    setMessage("Connexion Gmail retiree.");
    setIsDisconnecting(false);
  }

  const source = snapshot.source;

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <aside className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="space-y-3">
          <p className="app-kicker">Connexion Gmail</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Lire la boite pour suivre les candidatures reelles.
          </h2>
          <p className="text-sm leading-7 text-foreground">
            Cette connexion sert a relire les messages recus et envoyes dans Gmail afin
            de detecter les fils de candidature, meme si le mail initial n a pas ete
            envoye depuis l application.
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
          <a
            href="/api/email/google/connect?scopeSet=mailbox&redirectTo=%2Fworkspace%2Femail"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
          >
            {source ? "Reconnecter Gmail" : "Connecter Gmail"}
          </a>
          <a
            href="/api/email/google/connect?scopeSet=mailbox_send&redirectTo=%2Fworkspace%2Femail"
            className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
          >
            Activer brouillons et envoi
          </a>
          {source ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-800 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDisconnecting ? "Deconnexion..." : "Deconnecter Gmail"}
            </button>
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
      </aside>

      <div className="space-y-4">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Messages recents
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                Ce qui a ete indexe dans la boite.
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
                        {message.direction === "OUTBOUND" ? "Sortant vers" : "Recu de"}{" "}
                        {message.direction === "OUTBOUND"
                          ? message.toEmails[0] ?? "destinataire inconnu"
                          : message.fromEmail ?? "expediteur inconnu"}
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
                Aucun message Gmail n est encore synchronise.
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
