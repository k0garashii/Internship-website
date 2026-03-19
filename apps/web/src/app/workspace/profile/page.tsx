import Link from "next/link";

import { getCurrentViewer } from "@/lib/auth/session";
import {
  getProfileFormData,
  mapAccountToProfileDraft,
} from "@/lib/profile/profile-form-data";

export default async function ProfileManagementPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const account = await getProfileFormData(viewer.userId);

  if (!account) {
    return null;
  }

  const draft = mapAccountToProfileDraft(account);
  const validatedDomains = draft.domains.filter((domain) => domain.isValidated);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
          Gestion du profil
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Centralise le profil, les preferences et les domaines utiles.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted md:text-lg">
          Depuis cet espace, tu ouvres le profil complet, ajustes le ciblage de
          recherche et gardes un oeil sur les domaines valides sans surcharger la
          navigation principale.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Profil complet
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Identite et parcours
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {draft.profile.headline ||
              "Renseigne ton positionnement, tes competences et toutes les contraintes de candidature."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/workspace/onboarding"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Modifier le profil
            </Link>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Preferences
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Roles, zones et domaines
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {draft.profile.targetRoles ||
              "Ajuste ici les postes cibles, les mots cles, les localisations et l ordre des domaines."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/workspace/preferences"
              className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
            >
              Modifier les preferences
            </Link>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Domaines Gemini
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Validation integree aux preferences
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {validatedDomains.length > 0
              ? `${validatedDomains.length} domaine(s) deja retenu(s). La modification passe maintenant directement par la page preferences.`
              : "Aucun domaine valide pour l instant. Genere une base initiale puis confirme uniquement ce qui est pertinent dans la page preferences."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/workspace/preferences"
              className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
            >
              Modifier les domaines
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Resume profil
          </p>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-sm text-muted">Competences</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {draft.profile.skills || "Aucune competence clef encore resumee."}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Localisations</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {draft.profile.preferredLocations ||
                  "Aucune localisation prioritaire encore indiquee."}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Disponibilite</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {draft.profile.availabilityDate
                  ? `Debut ${draft.profile.availabilityDate}${
                      draft.profile.availabilityEndDate
                        ? ` - Fin ${draft.profile.availabilityEndDate}`
                        : ""
                    }`
                  : "Aucune fenetre de disponibilite encore precisee."}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Mots cles</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {draft.profile.searchKeywords ||
                  "Aucun mot cle de recherche encore structure."}
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
                    {domain.rationale || "Sans justification detaillee pour l instant."}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-muted">
                Aucun domaine retenu. Passe par la page preferences pour construire la
                base initiale.
              </p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
