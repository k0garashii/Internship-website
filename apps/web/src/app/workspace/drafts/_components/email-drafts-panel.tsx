"use client";

import { useState } from "react";

import type { EmailDraftListItem } from "@/lib/email/drafts";

type Props = {
  initialDrafts: EmailDraftListItem[];
  gmailConnected: boolean;
  gmailCanSend: boolean;
};

type DraftState = {
  recipientEmail: string;
  subject: string;
  body: string;
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

function buildInitialState(drafts: EmailDraftListItem[]) {
  return Object.fromEntries(
    drafts.map((draft) => [
      draft.id,
      {
        recipientEmail: draft.recipientEmail ?? "",
        subject: draft.subject ?? "",
        body: draft.body,
      },
    ]),
  ) as Record<string, DraftState>;
}

export function EmailDraftsPanel({
  initialDrafts,
  gmailConnected,
  gmailCanSend,
}: Props) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [editorState, setEditorState] = useState<Record<string, DraftState>>(
    buildInitialState(initialDrafts),
  );
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateEditorState(draftId: string, nextState: Partial<DraftState>) {
    setEditorState((current) => ({
      ...current,
      [draftId]: {
        ...(current[draftId] ?? { recipientEmail: "", subject: "", body: "" }),
        ...nextState,
      },
    }));
  }

  function applyDraftUpdate(payload: EmailDraftListItem) {
    setDrafts((current) => current.map((draft) => (draft.id === payload.id ? payload : draft)));
    setEditorState((current) => ({
      ...current,
      [payload.id]: {
        recipientEmail: payload.recipientEmail ?? "",
        subject: payload.subject ?? "",
        body: payload.body,
      },
    }));
  }

  async function handleSaveDraft(draftId: string) {
    const state = editorState[draftId];

    if (!state) {
      return;
    }

    setPendingDraftId(draftId);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/email/drafts/${draftId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(state),
    });

    const payload = (await response.json()) as EmailDraftListItem & {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible de sauvegarder le brouillon");
      setPendingDraftId(null);
      return;
    }

    applyDraftUpdate(payload);
    setMessage("Brouillon enregistre.");
    setPendingDraftId(null);
  }

  async function handleCreateGmailDraft(draftId: string) {
    const state = editorState[draftId];

    if (!state) {
      return;
    }

    setPendingDraftId(draftId);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/email/drafts/${draftId}/gmail-draft`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipientEmail: state.recipientEmail,
      }),
    });

    const payload = (await response.json()) as EmailDraftListItem & {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible de creer le brouillon Gmail");
      setPendingDraftId(null);
      return;
    }

    applyDraftUpdate(payload);
    setMessage("Brouillon Gmail cree.");
    setPendingDraftId(null);
  }

  async function handleSendGmail(draftId: string) {
    const state = editorState[draftId];

    if (!state) {
      return;
    }

    setPendingDraftId(draftId);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/email/drafts/${draftId}/gmail-send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipientEmail: state.recipientEmail,
      }),
    });

    const payload = (await response.json()) as EmailDraftListItem & {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Impossible d envoyer via Gmail");
      setPendingDraftId(null);
      return;
    }

    applyDraftUpdate(payload);
    setMessage("Email envoye via Gmail.");
    setPendingDraftId(null);
  }

  async function handleCopyDraft(draftId: string) {
    const state = editorState[draftId];

    if (!state) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `A: ${state.recipientEmail}\nSujet: ${state.subject}\n\n${state.body}`,
      );
      setMessage("Brouillon copie dans le presse-papiers.");
      setError(null);
    } catch {
      setError("Impossible de copier le brouillon.");
    }
  }

  return (
    <section className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
          Brouillons
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Relire, corriger et pousser vers Gmail si le flux est actif.
        </h2>
        <p className="text-sm leading-7 text-foreground">
          La sauvegarde garde le brouillon en base. Si Gmail est connecte, tu peux ensuite
          creer un brouillon Gmail ou envoyer directement depuis l application.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
          <p className="text-sm text-muted">Connexion Gmail</p>
          <p className="mt-2 text-lg font-medium text-foreground">
            {gmailConnected ? "Active" : "A connecter"}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
          <p className="text-sm text-muted">Brouillon / envoi Gmail</p>
          <p className="mt-2 text-lg font-medium text-foreground">
            {gmailCanSend ? "Disponible" : "Permissions manquantes"}
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

      {drafts.length > 0 ? (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const state = editorState[draft.id] ?? {
              recipientEmail: draft.recipientEmail ?? "",
              subject: draft.subject ?? "",
              body: draft.body,
            };

            return (
              <article
                key={draft.id}
                className="rounded-[1.5rem] border border-line bg-white/70 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground">
                        {draft.status}
                      </span>
                      {draft.generatedBy ? (
                        <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground">
                          {draft.generatedBy}
                        </span>
                      ) : null}
                      {draft.deliveryProvider ? (
                        <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground">
                          {draft.deliveryProvider}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-foreground">
                        {draft.jobOffer?.title ?? "Brouillon sans offre"}
                      </h3>
                      <p className="mt-2 text-sm text-muted">
                        {draft.jobOffer?.companyName ?? "Entreprise inconnue"} - mis a jour le{" "}
                        {formatDateTime(draft.updatedAt)}
                      </p>
                    </div>
                  </div>
                  {draft.jobOffer ? (
                    <a
                      href={draft.jobOffer.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
                    >
                      Ouvrir l offre source
                    </a>
                  ) : null}
                </div>

                {draft.personalizationSummary ? (
                  <p className="mt-4 text-sm leading-7 text-foreground">
                    {draft.personalizationSummary}
                  </p>
                ) : null}

                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor={`draft-recipient-${draft.id}`}
                      className="text-xs font-medium uppercase tracking-[0.16em] text-muted"
                    >
                      Destinataire
                    </label>
                    <input
                      id={`draft-recipient-${draft.id}`}
                      type="email"
                      value={state.recipientEmail}
                      onChange={(event) =>
                        updateEditorState(draft.id, { recipientEmail: event.target.value })
                      }
                      placeholder="recruteur@entreprise.com"
                      className="mt-2 w-full rounded-[1rem] border border-line bg-card px-4 py-3 text-sm text-foreground"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`draft-subject-${draft.id}`}
                      className="text-xs font-medium uppercase tracking-[0.16em] text-muted"
                    >
                      Objet
                    </label>
                    <input
                      id={`draft-subject-${draft.id}`}
                      value={state.subject}
                      onChange={(event) =>
                        updateEditorState(draft.id, { subject: event.target.value })
                      }
                      className="mt-2 w-full rounded-[1rem] border border-line bg-card px-4 py-3 text-sm text-foreground"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`draft-body-${draft.id}`}
                      className="text-xs font-medium uppercase tracking-[0.16em] text-muted"
                    >
                      Corps
                    </label>
                    <textarea
                      id={`draft-body-${draft.id}`}
                      value={state.body}
                      onChange={(event) =>
                        updateEditorState(draft.id, { body: event.target.value })
                      }
                      rows={12}
                      className="mt-2 w-full rounded-[1rem] border border-line bg-card px-4 py-3 text-sm leading-7 text-foreground"
                    />
                  </div>
                </div>

                {(draft.gmailThreadId || draft.gmailDraftId || draft.gmailMessageId) ? (
                  <div className="surface-muted mt-4 rounded-[1rem] p-4 text-sm leading-7 text-foreground">
                    {draft.gmailThreadId ? <p>Thread Gmail: {draft.gmailThreadId}</p> : null}
                    {draft.gmailDraftId ? <p>Brouillon Gmail: {draft.gmailDraftId}</p> : null}
                    {draft.gmailMessageId ? <p>Message Gmail: {draft.gmailMessageId}</p> : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveDraft(draft.id)}
                    disabled={pendingDraftId === draft.id}
                    className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingDraftId === draft.id ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyDraft(draft.id)}
                    className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
                  >
                    Copier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateGmailDraft(draft.id)}
                    disabled={pendingDraftId === draft.id || !gmailConnected}
                    className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingDraftId === draft.id ? "Traitement..." : "Creer brouillon Gmail"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendGmail(draft.id)}
                    disabled={pendingDraftId === draft.id || !gmailCanSend}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingDraftId === draft.id ? "Traitement..." : "Envoyer via Gmail"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <article className="rounded-[1.5rem] border border-dashed border-line bg-white/70 p-6 text-sm leading-7 text-muted">
          Aucun brouillon n a encore ete genere. Lance d abord une recherche puis cree
          un brouillon depuis une offre persistee.
        </article>
      )}
    </section>
  );
}
