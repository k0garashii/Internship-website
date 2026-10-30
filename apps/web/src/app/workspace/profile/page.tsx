import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  getProfileFormData,
  mapAccountToProfileDraft,
} from "@/lib/profile/profile-form-data";

import { AccountDataPanel } from "./_components/account-data-panel";
import { DailyDigestPanel } from "./_components/daily-digest-panel";

export default async function ProfileManagementPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  const account = await getProfileFormData(viewer.userId);

  if (!account) {
    return null;
  }

  const draft = mapAccountToProfileDraft(account);
  const validatedDomains = draft.domains.filter((domain) => domain.isValidated);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">
          Gestion du profil
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Modifie ton profil, tes préférences et tes domaines d&apos;action.
        </h1>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Profil complet
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Identité et parcours
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {draft.profile.headline ||
              "Renseigne ton positionnement, tes compétences et toutes les contraintes de candidature."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/workspace/onboarding"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Modifier le profil
            </Link>
            <Link
              href="/workspace/profile/inference"
              className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
            >
              Voir le profil implicite
            </Link>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Préférences
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Rôles, zones et domaines
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {draft.profile.targetRoles ||
              "Ajuste ici les postes cibles, les mots clés, les localisations et l’ordre des domaines."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/workspace/preferences"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Modifier les préférences
            </Link>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Domaines Gemini
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Validation intégrée aux préférences
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {validatedDomains.length > 0
              ? `${validatedDomains.length} domaine(s) déjà retenu(s). La modification passe maintenant directement par la page préférences.`
              : "Aucun domaine validé pour l’instant. Génère une base initiale puis confirme uniquement ce qui est pertinent dans la page préférences."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/workspace/preferences"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Modifier les domaines
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Résumé profil
          </p>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-sm text-muted">Compétences</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {draft.profile.skills || "Aucune compétence clef encore résumée."}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Localisations</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {draft.profile.preferredLocations ||
                  "Aucune localisation prioritaire encore indiquée."}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Disponibilité</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {draft.profile.availabilityDate
                  ? `Début ${draft.profile.availabilityDate}${
                      draft.profile.availabilityEndDate
                        ? ` - Fin ${draft.profile.availabilityEndDate}`
                        : ""
                    }`
                  : "Aucune fenêtre de disponibilité encore précisée."}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Mots clés</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {draft.profile.searchKeywords ||
                  "Aucun mot clé de recherche encore structuré."}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Domaines actifs
          </p>
          <div className="mt-5 space-y-3">
            {validatedDomains.length > 0 ? (
              validatedDomains.map((domain) => (
                <div
                  key={domain.id}
                  className="rounded-[1.25rem] border border-line bg-white px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{domain.label}</p>
                  <p className="mt-1 text-sm leading-7 text-muted">
                    {domain.rationale || "Sans justification détaillée pour l’instant."}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-muted">
                Aucun domaine retenu. Passe par la page préférences pour construire la
                base initiale.
              </p>
            )}
          </div>
        </article>
      </section>

      <DailyDigestPanel
        initialEnabled={draft.dailyDigestEnabled}
        sentByAppMailer={Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)}
      />

      <AccountDataPanel />
    </main>
  );
}
