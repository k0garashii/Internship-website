"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  offerId: string;
  offerTitle: string;
};

type DeleteResponse = {
  deletedOfferId?: string;
  deletedOfferTitle?: string;
  deletedDraftCount?: number;
  error?: string;
};

export function DeletePersistedOfferButton({ offerId, offerTitle }: Props) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setIsDeleting(true);

    const response = await fetch(`/api/search/offers/${offerId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as DeleteResponse;

    if (!response.ok) {
      setError(payload.error ?? "Impossible de supprimer l offre");
      setIsDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-800 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? `Suppression de ${offerTitle}...` : "Supprimer de la base"}
      </button>

      {error ? (
        <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}
