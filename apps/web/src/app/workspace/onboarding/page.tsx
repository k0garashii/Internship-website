import { getCurrentViewer } from "@/lib/auth/session";
import {
  getProfileFormData,
  mapAccountToProfileDraft,
} from "@/lib/profile/profile-form-data";
import { ProfileOnboardingForm } from "./_components/profile-onboarding-form";

export default async function ProfileOnboardingPage() {
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
          Profil complet
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Structure ton profil avant de lancer la recherche.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted md:text-lg">
          Cette page rassemble les informations de base, les competences et les
          contraintes utiles au matching. Les donnees sont sauvegardees et rechargees
          depuis la base utilisateur.
        </p>
      </section>

      <ProfileOnboardingForm
        initialFullName={draft.fullName}
        initialEmail={draft.email}
        initialProfile={draft.profile}
      />
    </main>
  );
}
