"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  offerId: string;
  currentDecision: string | null;
  currentNote: string | null;
};

const decisions = [
  { value: "FAVORITE", label: "Pertinente" },
  { value: "MAYBE", label: "A revoir" },
  { value: "NOT_RELEVANT", label: "Non pertinente" },
] as const;

type FeedbackResponse = {
  id: string;
  decision: string;
  note: string | null;
  updatedAt: string;
  error?: string;
};

export function OfferFeedbackControls({
  offerId,
  currentDecision,
  currentNote,
}: Props) {
  const router = useRouter();
  const [decision, setDecision] = useState(currentDecision);
  const [note, setNote] = useState(currentNote ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(nextDecision: (typeof decisions)[number]["value"]) {
    setError(null);
    setIsLoading(true);

    const response = await fetch(`/api/search/offers/${offerId}/feedback`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        decision: nextDecision,
        note: note.trim() || undefined,
      }),
    });

    const payload = (await response.json()) as FeedbackResponse;

    if (!response.ok) {
      setError(payload.error ?? "Impossible d enregistrer le feedback");
      setIsLoading(false);
      return;
    }

    setDecision(payload.decision);
    setNote(payload.note ?? "");
    setIsLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-[1.25rem] border border-line bg-card p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Feedback offre</p>
        <p className="mt-1 text-sm leading-7 text-muted">
          Marque rapidement l offre selon sa pertinence puis ajoute une note si besoin.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {decisions.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handleSave(item.value)}
            disabled={isLoading}
            className={
              decision === item.value
                ? "rounded-full border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                : "rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        placeholder="Note facultative"
        className="w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm leading-7 text-foreground"
      />

      {error ? (
        <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}
