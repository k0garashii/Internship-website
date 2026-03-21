import { getCurrentViewer } from "@/lib/auth/session";
import { getForwardingSourceSnapshot } from "@/lib/email/forwarding";
import { getGmailConnectionSnapshot } from "@/lib/email/gmail-connection";
import { EmailForwardingPanel } from "./_components/email-forwarding-panel";
import { GmailMailboxPanel } from "./_components/gmail-mailbox-panel";

function getMailboxSummaryLabel() {
  return (snapshot: Awaited<ReturnType<typeof getGmailConnectionSnapshot>>) => {
    if (!snapshot.source) {
      return "Non connectee";
    }

    if (snapshot.source.status === "ERROR") {
      return "Connectee avec erreur de sync";
    }

    if (snapshot.source.status === "DISABLED") {
      return "Desactivee";
    }

    return snapshot.configured ? "Connectee" : "Connexion a completer";
  };
}

function getBannerMessage(status: string | null | undefined) {
  switch (status) {
    case "connected":
      return {
        tone: "success" as const,
        message: "Gmail est connecte et la premiere synchronisation a ete terminee.",
      };
    case "connected-needs-sync":
      return {
        tone: "warn" as const,
        message: "Gmail est connecte, mais la premiere synchronisation doit etre relancee manuellement.",
      };
    case "oauth-denied":
      return {
        tone: "warn" as const,
        message: "La connexion Google a ete annulee avant la fin.",
      };
    case "oauth-invalid-state":
      return {
        tone: "warn" as const,
        message: "Le retour OAuth Google n a pas pu etre valide. Relance la connexion Gmail.",
      };
    case "oauth-missing-config":
      return {
        tone: "warn" as const,
        message: "Les variables Google OAuth ne sont pas encore configurees sur cet environnement.",
      };
    case "oauth-error":
      return {
        tone: "warn" as const,
        message: "La connexion Google a echoue. Consulte les logs serveur puis relance l autorisation.",
      };
    default:
      return null;
  }
}

export default async function EmailWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const [gmailSnapshot, forwardingSnapshot, resolvedSearchParams] = await Promise.all([
    getGmailConnectionSnapshot(viewer.userId),
    getForwardingSourceSnapshot(viewer),
    (searchParams ??
      Promise.resolve({} as Record<string, string | string[] | undefined>)),
  ]);

  const gmailStatus = Array.isArray(resolvedSearchParams.gmail)
    ? resolvedSearchParams.gmail[0]
    : resolvedSearchParams.gmail;
  const banner = getBannerMessage(gmailStatus);
  const mailboxSummaryLabel = getMailboxSummaryLabel()(gmailSnapshot);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">Messagerie</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Suivre les reponses de candidature depuis la boite mail.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          Le produit cible maintenant une lecture Gmail pour comprendre les candidatures
          reelles, repasser sur les threads utiles et permettre ensuite l envoi depuis
          le site. Le forwarding dedie reste disponible plus bas comme filet MVP.
        </p>
        <div className="status-row mt-6">
          <div className="status-pill">Lecture Gmail cible</div>
          <div className="status-pill status-pill-info">Reponses detectees par thread</div>
          <div className="status-pill status-pill-info">Brouillons et envoi Gmail</div>
          <div className="status-pill status-pill-success">Forwarding fallback conserve</div>
        </div>
      </section>

      {banner ? (
        <section
          className={
            banner.tone === "success"
              ? "rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800"
              : "rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
          }
        >
          {banner.message}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Etat du parcours
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">OAuth Gmail</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {gmailSnapshot.oauthConfigured ? "Pret" : "A configurer"}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">Boite Gmail</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {mailboxSummaryLabel}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">Forwarding fallback</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {forwardingSnapshot.configured ? "Disponible" : "Non provisionne"}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Logique produit
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-foreground">
            <li>La detection de reponse ne depend pas des seuls mails envoyes via l app.</li>
            <li>La synchro lit les threads Gmail pour retrouver aussi les mails partis hors produit.</li>
            <li>Les brouillons Gmail peuvent ensuite reutiliser un thread detecte ou partir d une adresse renseignee.</li>
            <li>Le forwarding reste disponible pour centraliser des alertes ou des opportunites hors Gmail.</li>
          </ul>
        </article>
      </section>

      <GmailMailboxPanel initialSnapshot={gmailSnapshot} />
      <EmailForwardingPanel initialSnapshot={forwardingSnapshot} />
    </main>
  );
}
