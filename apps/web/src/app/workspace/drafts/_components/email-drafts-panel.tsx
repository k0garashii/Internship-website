"use client";

import { useState } from "react";

import type { EmailDraftListItem } from "@/lib/email/drafts";

type Props = {
  initialDrafts: EmailDraftListItem[];
};

type DraftState = {
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

export function EmailDraftsPanel({ initialDrafts }: Props) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [editorState, setEditorState] = useState<Record<string, DraftState>>(
    Object.fromEntries(
      initialDrafts.map((draft) => [
        draft.id,
        {
          subject: draft.subject ?? "",
          body: draft.body,
        },
      ]),
    ),
  );
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateEditorState(draftId: string, nextState: Partial<DraftState>) {
    setEditorState((current) => ({
      ...current,
      [draftId]: {
        ...(current[draftId] ?? { subject: "", body: "" }),
        ...nextState,
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

    setDrafts((current) => current.map((draft) => (draft.id === draftId ? payload : draft)));
    setEditorState((current) => ({
      ...current,
      [draftId]: {
        subject: payload.subject ?? "",
        body: payload.body,
      },
    }));
    setMessage("Brouillon enregistre.");
    setPendingDraftId(null);
  }

  async function handleCopyDraft(draftId: string) {
    const state = editorState[draftId];

    if (!state) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`Sujet: ${state.subject}\n\n${state.body}`);
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
          Relire, corriger et copier avant usage externe.
        </h2>
        <p className="text-sm leading-7 text-foreground">
          Chaque brouillon reste modifiable. Une sauvegarde place le draft en
          `READY_FOR_REVIEW`, et la copie prend l objet puis le corps complets.
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

      {drafts.length > 0 ? (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const state = editorState[draft.id] ?? {
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
