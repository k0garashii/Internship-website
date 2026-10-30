"use client";

import { useState } from "react";

type Props = {
  initialEnabled: boolean;
  sentByAppMailer: boolean;
};

export function DailyDigestPanel({ initialEnabled, sentByAppMailer }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(nextValue: boolean) {
    setIsSaving(true);
    setError(null);

    const response = await fetch("/api/profile/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyDigestEnabled: nextValue }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Impossible d’enregistrer le réglage.");
      return;
    }

    setEnabled(nextValue);
  }

  return (
    <section className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
        Recherche automatique
      </p>
      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Recherche quotidienne et récapitulatif
          </h2>
          <p className="text-sm leading-7 text-muted">
            Chaque jour, une recherche est relancée avec ton profil et tu reçois un email
            avec les nouvelles offres pertinentes, les candidatures à relancer et tes
            entretiens à venir.{" "}
            {sentByAppMailer
              ? "Il est envoyé à l’adresse de ton compte."
              : "L’email part de ta boîte Gmail vers toi-même : il faut avoir autorisé l’envoi dans la page Messagerie."}
          </p>
        </div>
        <label className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            disabled={isSaving}
            onChange={(event) => void toggle(event.target.checked)}
            className="h-5 w-5 rounded border-line"
          />
          {enabled ? "Activé" : "Désactivé"}
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
