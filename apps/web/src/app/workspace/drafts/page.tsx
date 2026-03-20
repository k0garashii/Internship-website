import { getCurrentViewer } from "@/lib/auth/session";
import { listEmailDraftsForUser } from "@/lib/email/drafts";
import { EmailDraftsPanel } from "./_components/email-drafts-panel";

export default async function DraftsPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const drafts = await listEmailDraftsForUser(viewer.userId);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">
          Brouillons d email
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Relire avant envoi externe.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          Cette page centralise les brouillons deja generes depuis les offres retenues.
          Tu peux relire le sujet, corriger le corps, sauvegarder puis copier le resultat
          avant tout usage en dehors de l application.
        </p>
        <div className="status-row mt-6">
          <div className="status-pill">Brouillons generes depuis les offres</div>
          <div className="status-pill status-pill-info">Edition et sauvegarde sur place</div>
          <div className="status-pill status-pill-success">Copie facile avant envoi externe</div>
        </div>
      </section>

      <EmailDraftsPanel initialDrafts={drafts} />
    </main>
  );
}
