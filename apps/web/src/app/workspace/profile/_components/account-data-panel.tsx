"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, startTransition, useState } from "react";

export function AccountDataPanel() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      redirectTo?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "La suppression a échoué.");
      setIsSubmitting(false);
      return;
    }

    startTransition(() => {
      router.push(payload.redirectTo ?? "/");
      router.refresh();
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
          Mes données
        </p>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Exporter toutes mes données
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          Télécharge un fichier JSON avec ton profil, tes recherches, tes offres, tes
          brouillons et les emails synchronisés. Les mots de passe et jetons d&apos;accès
          n&apos;y figurent pas.
        </p>
        <div className="mt-6">
          <a
            href="/api/account/export"
            download
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
          >
            Télécharger mes données
          </a>
        </div>
      </article>

      <form
        onSubmit={handleDelete}
        className="space-y-4 rounded-[1.5rem] border border-red-200 bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]"
      >
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-red-700">
          Zone sensible
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Supprimer mon compte
        </h2>
        <p className="text-sm leading-7 text-muted">
          Supprime définitivement ton compte, ton espace personnel et toutes les données
          associées. L&apos;accès Gmail est révoqué. Cette action est irréversible.
        </p>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="delete-password">
            Mot de passe
          </label>
          <input
            id="delete-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            autoComplete="current-password"
            required
          />
        </div>
        <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(event) => setIsConfirmed(event.target.checked)}
            className="mt-1"
          />
          Je comprends que mes données seront supprimées définitivement.
        </label>
        {error ? (
          <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={!isConfirmed || !password || isSubmitting}
          className="inline-flex items-center rounded-full bg-red-700 px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Suppression..." : "Supprimer définitivement mon compte"}
        </button>
      </form>
    </section>
  );
}
