import { getCurrentViewer } from "@/lib/auth/session";
import {
  getProfileFormData,
  mapAccountToProfileDraft,
} from "@/lib/profile/profile-form-data";
import { PreferencesForm } from "./_components/preferences-form";

export default async function PreferencesPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const account = await getProfileFormData(viewer.userId);

  if (!account) {
    return null;
  }

  const draft = mapAccountToProfileDraft(account);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
          Preferences de recherche
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Ajuste les roles, les zones et les domaines sans dupliquer le profil.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted md:text-lg">
          Les contraintes de candidature restent sur le profil complet. Cette page se
          concentre sur les cibles de recherche et sur l edition directe des domaines
          issus de Gemini.
        </p>
      </section>

      <PreferencesForm
        initialPayload={{
          fullName: draft.fullName,
          headline: draft.profile.headline,
          summary: draft.profile.summary,
          school: draft.profile.school,
          degree: draft.profile.degree,
          graduationYear: draft.profile.graduationYear,
          city: draft.profile.city,
          countryCode: draft.profile.countryCode,
          experienceLevel: draft.profile.experienceLevel,
          availabilityDate: draft.profile.availabilityDate,
          availabilityEndDate: draft.profile.availabilityEndDate,
          linkedinUrl: draft.profile.linkedinUrl,
          githubUrl: draft.profile.githubUrl,
          portfolioUrl: draft.profile.portfolioUrl,
          resumeUrl: draft.profile.resumeUrl,
          skills: draft.profile.skills,
          targetRoles: draft.profile.targetRoles,
          searchKeywords: draft.profile.searchKeywords,
          preferredLocations: draft.profile.preferredLocations,
          preferredDomains: draft.profile.preferredDomains,
          remotePreference: draft.profile.remotePreference,
          employmentTypes: draft.profile.employmentTypes,
          salaryExpectationMin: draft.profile.salaryExpectationMin,
          salaryExpectationMax: draft.profile.salaryExpectationMax,
          visaNeedsSponsorship: draft.profile.visaNeedsSponsorship,
          preferencesNotes: draft.profile.preferencesNotes,
        }}
        initialDomains={draft.domains}
      />
    </main>
  );
}
