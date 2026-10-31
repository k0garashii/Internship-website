"use client";

import { useState } from "react";

type Props = {
  canManage: boolean;
  hasPaidSubscription: boolean;
  hasStripeCustomer: boolean;
  paymentsConfigured: boolean;
};

export function BillingActions({
  canManage,
  hasPaidSubscription,
  hasStripeCustomer,
  paymentsConfigured,
}: Props) {
  const [pendingAction, setPendingAction] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function redirectTo(action: "checkout" | "portal") {
    setPendingAction(action);
    setError(null);

    const response = await fetch(`/api/billing/${action}`, { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

    if (!response.ok || !payload.url) {
      setPendingAction(null);
      setError(payload.error ?? "Une erreur est survenue.");
      return;
    }

    window.location.assign(payload.url);
  }

  if (!paymentsConfigured) {
    return (
      <p className="text-sm text-muted">
        Le paiement en ligne n’est pas encore ouvert. Reviens bientôt !
      </p>
    );
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted">
        Seuls le propriétaire et les administrateurs du workspace gèrent l’abonnement.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {!hasPaidSubscription ? (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void redirectTo("checkout")}
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {pendingAction === "checkout" ? "Ouverture du paiement…" : "Passer Pro – 4,99 €/mois"}
          </button>
        ) : null}
        {hasStripeCustomer ? (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void redirectTo("portal")}
            className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {pendingAction === "portal" ? "Ouverture…" : "Gérer mon abonnement et mes factures"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
