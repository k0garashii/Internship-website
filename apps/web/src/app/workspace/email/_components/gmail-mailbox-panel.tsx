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
      `${payload.processedMessageCount} message(s) lus, ${payload.detectedReplyCount} signal(aux) de reponse recalcules.`,
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
            <p className="text-sm text-muted">OAuth Google</p>
            <p className="mt-2 text-lg font-medium text-foreground">
              {snapshot.oauthConfigured ? "Configure" : "A configurer"}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
            <p className="text-sm text-muted">Etat Gmail</p>
            <p className="mt-2 text-lg font-medium text-foreground">
              {getConnectionStateLabel(snapshot)}
            </p>
          </div>
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
        </div>

        {source ? (
          <div className="space-y-4 rounded-[1.5rem] border border-line bg-white/70 p-5">
            <div>
              <p className="text-sm text-muted">Boite reliee</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {source.mailboxAddress ?? "Adresse Gmail a confirmer"}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted">Statut connexion</p>
                <p className="mt-2 text-sm leading-7 text-foreground">{source.status}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Derniere sync</p>
                <p className="mt-2 text-sm leading-7 text-foreground">
                  {formatDateTime(source.lastSyncedAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Messages traces</p>
                <p className="mt-2 text-sm leading-7 text-foreground">{source.messageCount}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted">Lecture Gmail</p>
                <p className="mt-2 text-sm leading-7 text-foreground">
                  {source.hasMailboxScope ? "Accordee" : "Manquante"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Envoi Gmail</p>
                <p className="mt-2 text-sm leading-7 text-foreground">
                  {source.hasSendScope ? "Accorde" : "A activer"}
                </p>
              </div>
            </div>

            {source.lastSyncError ? (
              <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {source.lastSyncError}
              </div>
            ) : null}
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Synchronisation
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                Definir la portee lue dans Gmail.
              </h3>
            </div>
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

          <div className="mt-5 space-y-3">
            <label
              htmlFor="gmail-sync-query"
              className="text-xs font-medium uppercase tracking-[0.16em] text-muted"
            >
              Requete Gmail
            </label>
            <textarea
              id="gmail-sync-query"
              value={syncQuery}
              onChange={(event) => setSyncQuery(event.target.value)}
              rows={3}
              className="w-full rounded-[1rem] border border-line bg-card px-4 py-3 text-sm leading-7 text-foreground"
              placeholder="in:anywhere newer_than:120d -category:promotions -category:social"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Enregistrement..." : "Enregistrer le filtre"}
              </button>
              <p className="text-sm leading-7 text-muted">
                Exemple: inclure `label:candidatures` si tu classes tes mails.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                Reponses detectees
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                Fils rapproches des offres deja connues.
              </h3>
            </div>
            {source ? (
              <div className="rounded-full border border-line bg-white px-4 py-2 text-sm text-foreground">
                {source.responseSignalCount} signal(aux)
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.detectedReplies.length > 0 ? (
              snapshot.detectedReplies.map((signal) => (
                <article
                  key={signal.id}
                  className="rounded-[1.25rem] border border-line bg-white/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {signal.jobOfferTitle}
                      </p>
                      <p className="text-sm text-muted">{signal.companyName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {getReplyStatusLabel(signal.status)}
                      </span>
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                        {Math.round(signal.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  {signal.summary ? (
                    <p className="mt-3 text-sm leading-7 text-foreground">{signal.summary}</p>
                  ) : null}
                  {signal.latestMessage ? (
                    <div className="surface-muted mt-4 rounded-[1rem] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                        Dernier message relie
                      </p>
                      <p className="mt-2 text-sm leading-7 text-foreground">
                        {signal.latestMessage.subject ?? "Sans sujet"} -{" "}
                        {signal.latestMessage.fromEmail ?? "expediteur inconnu"}
                      </p>
                      {signal.latestMessage.snippet ? (
                        <p className="mt-2 text-sm leading-7 text-foreground">
                          {signal.latestMessage.snippet}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/workspace/search/offers/${signal.jobOfferId}`}
                      className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
                    >
                      Ouvrir l offre
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-line bg-white/70 p-5 text-sm leading-7 text-muted">
                Aucun rapprochement d offre n est encore detecte. Connecte Gmail puis
                lance une premiere synchronisation.
              </div>
            )}
          </div>
        </article>

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
