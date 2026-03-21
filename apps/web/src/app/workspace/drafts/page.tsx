import { getCurrentViewer } from "@/lib/auth/session";
import { listEmailDraftsForUser } from "@/lib/email/drafts";
import { getGmailConnectionSnapshot } from "@/lib/email/gmail-connection";
import { EmailDraftsPanel } from "./_components/email-drafts-panel";

export default async function DraftsPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const [drafts, gmailSnapshot] = await Promise.all([
    listEmailDraftsForUser(viewer.userId),
    getGmailConnectionSnapshot(viewer.userId),
  ]);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">Brouillons d email</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Relire avant envoi, puis pousser vers Gmail si besoin.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          Cette page centralise les brouillons generes depuis les offres retenues. Tu
          peux corriger le destinataire, ajuster le corps, sauvegarder puis soit creer
          un brouillon Gmail, soit envoyer directement si les permissions Google sont
          actives.
        </p>
        <div className="status-row mt-6">
          <div className="status-pill">Edition et sauvegarde sur place</div>
          <div className="status-pill status-pill-info">Destinataire Gmail modifiable</div>
          <div className="status-pill status-pill-info">
            {gmailSnapshot.configured ? "Gmail connecte" : "Gmail a connecter"}
          </div>
          <div className="status-pill status-pill-success">
            {gmailSnapshot.source?.hasSendScope
              ? "Envoi Gmail actif"
              : "Envoi Gmail a autoriser"}
          </div>
        </div>
      </section>

      <EmailDraftsPanel
        initialDrafts={drafts}
        gmailConnected={gmailSnapshot.configured}
        gmailCanSend={gmailSnapshot.source?.hasSendScope ?? false}
      />
    </main>
  );
}
