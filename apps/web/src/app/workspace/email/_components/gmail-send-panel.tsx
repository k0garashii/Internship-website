"use client";

import { useState } from "react";

import type { EmailDeliveryLogListItem } from "@/lib/email/delivery-logs";

type Props = {
  defaultRecipientEmail: string;
  gmailCanSend: boolean;
  initialLogs: EmailDeliveryLogListItem[];
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOperationLabel(value: EmailDeliveryLogListItem["operation"]) {
  switch (value) {
    case "ADHOC_GMAIL_SEND":
      return "Envoi direct";
    case "GMAIL_DRAFT":
      return "Creation brouillon";
    case "GMAIL_SEND":
      return "Envoi depuis brouillon";
    default:
      return value;
  }
}

export function GmailSendPanel({
  defaultRecipientEmail,
  gmailCanSend,
  initialLogs,
}: Props) {
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail);
  const [subject, setSubject] = useState("Test Gmail Internship");
  const [body, setBody] = useState(
    "Bonjour,\n\nCeci est un email de verification envoye depuis l application Internship.\n\nMerci.",
  );
  const [logs, setLogs] = useState(initialLogs);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    setIsSending(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/email/google/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipientEmail,
        subject,
        body,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      deliveryLog?: EmailDeliveryLogListItem;
      logs?: EmailDeliveryLogListItem[];
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible d envoyer le mail de test");
      if (payload.logs) {
        setLogs(payload.logs);
      }
      setIsSending(false);
      return;
    }

    setLogs(payload.logs ?? logs);
    setMessage("Email Gmail envoye.");
    setIsSending(false);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Envoi Gmail
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Envoyer un mail depuis l application.
          </h2>
          <p className="text-sm leading-7 text-foreground">
            Ce bloc permet de verifier l envoi Gmail sans passer par une offre. Il
            utilise les memes permissions que les envois finaux depuis les brouillons.
          </p>
        </div>

        {message ? (
          <div className="mt-5 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="gmail-send-recipient"
              className="text-xs font-medium uppercase tracking-[0.16em] text-muted"
            >
              Destinataire
            </label>
            <input
              id="gmail-send-recipient"
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              className="mt-2 w-full rounded-[1rem] border border-line bg-card px-4 py-3 text-sm text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="gmail-send-subject"
              className="text-xs font-medium uppercase tracking-[0.16em] text-muted"
            >
              Objet
            </label>
            <input
              id="gmail-send-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="mt-2 w-full rounded-[1rem] border border-line bg-card px-4 py-3 text-sm text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="gmail-send-body"
              className="text-xs font-medium uppercase tracking-[0.16em] text-muted"
            >
              Corps
            </label>
            <textarea
              id="gmail-send-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              className="mt-2 w-full rounded-[1rem] border border-line bg-card px-4 py-3 text-sm leading-7 text-foreground"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !gmailCanSend}
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "Envoi..." : "Envoyer le mail"}
          </button>
        </div>
      </article>

      <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Journal d envoi
            </p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
              Tentatives Gmail recentes.
            </h3>
          </div>
          <div className="rounded-full border border-line bg-white px-4 py-2 text-sm text-foreground">
            {logs.length} entree(s)
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {logs.length > 0 ? (
            logs.map((log) => (
              <article
                key={log.id}
                className="rounded-[1.25rem] border border-line bg-white/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {log.subject ?? "Sans objet"}
                    </p>
                    <p className="text-sm text-muted">
                      {log.recipientEmail} - {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-foreground">
                      {getOperationLabel(log.operation)}
                    </span>
                    <span
                      className={
                        log.status === "SUCCESS"
                          ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                          : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800"
                      }
                    >
                      {log.status}
                    </span>
                  </div>
                </div>

                {log.errorMessage ? (
                  <p className="mt-3 text-sm leading-7 text-red-800">{log.errorMessage}</p>
                ) : null}

                {log.bodyPreview ? (
                  <p className="mt-3 text-sm leading-7 text-foreground">{log.bodyPreview}</p>
                ) : null}

                {(log.providerMessageId || log.providerThreadId || log.providerDraftId) ? (
                  <div className="surface-muted mt-4 rounded-[1rem] p-4 text-sm leading-7 text-foreground">
                    {log.providerDraftId ? <p>Brouillon Gmail: {log.providerDraftId}</p> : null}
                    {log.providerMessageId ? <p>Message Gmail: {log.providerMessageId}</p> : null}
                    {log.providerThreadId ? <p>Thread Gmail: {log.providerThreadId}</p> : null}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-line bg-white/70 p-5 text-sm leading-7 text-muted">
              Aucune tentative d envoi Gmail n est encore journalisee.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

