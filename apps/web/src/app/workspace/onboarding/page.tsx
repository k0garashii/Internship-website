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
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">
          Profil complet
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Structure ton profil avant de lancer la recherche.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          Cette page rassemble les informations de base, les competences et les
          contraintes utiles au matching. Les donnees sont sauvegardees et rechargees
          depuis la base utilisateur.
        </p>
        <div className="status-row mt-6">
          <div className="status-pill">Labels visibles sur tous les champs</div>
          <div className="status-pill status-pill-info">Disponibilite debut et fin distinctes</div>
          <div className="status-pill status-pill-success">Retour de sauvegarde explicite</div>
        </div>
      </section>

      <ProfileOnboardingForm
        initialFullName={draft.fullName}
        initialEmail={draft.email}
        initialProfile={draft.profile}
      />
    </main>
  );
}
