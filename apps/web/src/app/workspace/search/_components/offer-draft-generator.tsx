"use client";

import { useState } from "react";

type Props = {
  jobOfferId: string;
};

type DraftResponse = {
  draftId: string;
  subject: string;
  body: string;
  provider: "gemini" | "fallback";
  generatedBy: string;
  personalizationSummary: string;
  error?: string;
};

export function OfferDraftGenerator({ jobOfferId }: Props) {
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerateDraft() {
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/email/drafts/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jobOfferId,
      }),
    });

    const payload = (await response.json()) as DraftResponse;

    if (!response.ok) {
      setError(payload.error ?? "Impossible de generer le brouillon");
      setIsLoading(false);
      return;
    }

    setDraft(payload);
    setIsLoading(false);
  }

  return (
    <div className="space-y-4 rounded-[1.25rem] border border-line bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Brouillon de candidature</p>
          <p className="mt-1 text-sm leading-7 text-muted">
            Genere un premier email contextualise a partir de cette offre et du profil
            sauvegarde.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Generation..." : "Generer un brouillon"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {draft ? (
        <div className="space-y-3 rounded-[1rem] border border-line bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground">
              {draft.provider === "gemini" ? "Gemini" : "Fallback"}
            </span>
            <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-foreground">
              {draft.generatedBy}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Objet</p>
            <p className="mt-2 text-sm font-medium text-foreground">{draft.subject}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Corps</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-[1rem] border border-line bg-slate-50 p-4 text-sm leading-7 text-foreground">
              {draft.body}
            </pre>
          </div>
          <p className="text-xs leading-6 text-muted">{draft.personalizationSummary}</p>
        </div>
      ) : null}
    </div>
  );
}
