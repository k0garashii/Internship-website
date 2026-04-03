import Link from "next/link";

import { getCurrentViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getGmailConnectionSnapshot } from "@/lib/email/gmail-connection";

function getGmailBanner(status: string | undefined) {
  switch (status) {
    case "connected":
      return {
        tone: "success" as const,
        message:
          "Gmail est connecte. Si tu veux envoyer depuis le site, active maintenant brouillons et envoi juste en dessous.",
      };
    case "connected-needs-sync":
      return {
        tone: "warn" as const,
        message:
          "Gmail est connecte, mais la premiere synchronisation doit etre relancee depuis la page Messagerie.",
      };
    case "oauth-denied":
      return {
        tone: "warn" as const,
        message: "La connexion Google a ete annulee avant la fin.",
      };
    case "oauth-invalid-state":
      return {
        tone: "warn" as const,
        message: "Le retour Google n a pas pu etre valide. Relance la connexion Gmail.",
      };
    case "oauth-missing-config":
      return {
        tone: "warn" as const,
        message: "La configuration Google OAuth est absente sur cet environnement.",
      };
    case "oauth-error":
      return {
        tone: "warn" as const,
        message: "La connexion Google a echoue. Consulte les logs puis relance le parcours Gmail.",
      };
    default:
      return null;
  }
}

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const [account, gmailSnapshot, resolvedSearchParams] = await Promise.all([
    db.user.findUnique({
      where: {
        id: viewer.userId,
      },
      select: {
        fullName: true,
        email: true,
        profile: {
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            inboundEmails: true,
            searchRuns: true,
            jobOffers: true,
            drafts: true,
          },
        },
      },
    }),
    getGmailConnectionSnapshot(viewer.userId),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);

  if (!account) {
    return null;
  }

  const gmailStatus = Array.isArray(resolvedSearchParams.gmail)
    ? resolvedSearchParams.gmail[0]
    : resolvedSearchParams.gmail;
  const gmailBanner = getGmailBanner(gmailStatus);
  const canConnectGmail = gmailSnapshot.oauthConfigured && !gmailSnapshot.source;
  const canUpgradeGmail =
    Boolean(gmailSnapshot.source?.hasMailboxScope) && !gmailSnapshot.source?.hasSendScope;
  const gmailIsReady =
    Boolean(gmailSnapshot.source?.hasMailboxScope) && Boolean(gmailSnapshot.source?.hasSendScope);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">
          Tableau de bord
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Bonjour {account.fullName ?? "utilisateur"}.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          Cette vue garde uniquement les indicateurs utiles. La navigation de gauche
          sert ensuite a completer le profil, ajuster la recherche et suivre les
          messages ou brouillons sans changer de logique.
        </p>
        <div className="status-row mt-6">
          <div className="status-pill">Profil + preferences</div>
          <div className="status-pill status-pill-info">Recherche + offres</div>
          <div className="status-pill status-pill-success">Emails + brouillons</div>
        </div>
      </section>

      {gmailBanner ? (
        <section
          className={
            gmailBanner.tone === "success"
              ? "rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800"
              : "rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
          }
        >
          {gmailBanner.message}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Gmail
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Connexion disponible directement ici.
          </h2>
          <p className="mt-3 text-sm leading-7 text-foreground">
            La connexion Gmail n est plus reservee a la page Messagerie. Tu peux la
            lancer des l arrivee sur le tableau de bord, puis passer a la page suivante
            pour synchroniser la boite ou envoyer.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {canConnectGmail ? (
              <a
                href="/api/email/google/connect?scopeSet=mailbox&redirectTo=%2Fworkspace"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
              >
                Connecter Gmail
              </a>
            ) : null}

            {canUpgradeGmail ? (
              <a
                href="/api/email/google/connect?scopeSet=mailbox_send&redirectTo=%2Fworkspace"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
              >
                Activer brouillons et envoi
              </a>
            ) : null}

            <Link
              href="/workspace/email"
              className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
            >
              Ouvrir la messagerie
            </Link>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Etat Gmail
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">Lecture de boite</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {!gmailSnapshot.oauthConfigured
                  ? "OAuth absent"
                  : gmailSnapshot.source?.hasMailboxScope
                    ? "Connectee"
                    : "Non connectee"}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">Brouillons et envoi</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {gmailIsReady ? "Actifs" : "A completer"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted">
            Une fois Gmail connecte, la page Messagerie garde surtout la synchro, les
            messages detectes et l espace d envoi.
          </p>
        </article>
      </section>

      <section>
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Espace SaaS
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Pilotage du workspace
          </h2>
          <p className="mt-3 text-sm leading-7 text-foreground">
            Une page dediee centralise maintenant le workspace actif, les membres,
            le plan courant et les checks providers pour rendre la structure SaaS
            plus visible dans le produit.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/workspace/workspace"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Ouvrir le workspace
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Email
          </p>
          <p className="mt-4 text-lg font-medium text-foreground">{account.email}</p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Canal principal pour la connexion et les alertes.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Profil
          </p>
          <p className="mt-4 text-lg font-medium text-foreground">
            {account.profile ? "Initialise" : "Absent"}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            {account.profile
              ? "Le socle profil est en base."
              : "Le profil complet reste a renseigner."}
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Recherches
          </p>
          <p className="mt-4 text-lg font-medium text-foreground">
            {account._count.searchRuns}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Lancements de collecte ou de plan de recherche.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Ingestion email
          </p>
          <p className="mt-4 text-lg font-medium text-foreground">
            {account._count.inboundEmails}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Messages recus via forwarding dedie.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Offres
          </p>
          <p className="mt-4 text-lg font-medium text-foreground">{account._count.jobOffers}</p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Opportunites persistees cote produit.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Brouillons
          </p>
          <p className="mt-4 text-lg font-medium text-foreground">{account._count.drafts}</p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Elements prets a etre qualifies ou relus.
          </p>
        </article>
      </section>
    </main>
  );
}
