import { getCurrentViewer } from "@/lib/auth/session";
import { listEmailDeliveryLogsForUser } from "@/lib/email/delivery-logs";
import { getForwardingSourceSnapshot } from "@/lib/email/forwarding";
import { getGmailConnectionSnapshot } from "@/lib/email/gmail-connection";
import { GmailSendPanel } from "./_components/gmail-send-panel";
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

  const [gmailSnapshot, forwardingSnapshot, deliveryLogs, resolvedSearchParams] = await Promise.all([
    getGmailConnectionSnapshot(viewer.userId),
    getForwardingSourceSnapshot(viewer),
    listEmailDeliveryLogsForUser(viewer.userId),
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
          Suivie de candidature en direct.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          La connexion Gmail se lance maintenant depuis le tableau de bord. Cette page
          reste centree sur la lecture des fils, la synchronisation et l envoi une fois
          les permissions completes.
        </p>
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
      <GmailMailboxPanel initialSnapshot={gmailSnapshot} />

      {gmailSnapshot.source?.hasSendScope ? (
        <GmailSendPanel
          defaultRecipientEmail={viewer.email ?? ""}
          gmailCanSend={gmailSnapshot.source.hasSendScope}
          initialLogs={deliveryLogs}
        />
      ) : (
        <section className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Envoi Gmail
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            L espace d envoi apparaitra ici apres activation.
          </h2>
          <p className="mt-3 text-sm leading-7 text-foreground">
            Le bouton d activation brouillons et envoi n apparait plus dans cette
            page. Il est maintenant propose sur le tableau de bord juste apres la
            connexion Gmail.
          </p>
        </section>
      )}
    </main>
  );
}
