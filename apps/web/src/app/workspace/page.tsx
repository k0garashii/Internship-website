import { getCurrentViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function WorkspacePage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const account = await db.user.findUnique({
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
  });

  if (!account) {
    return null;
  }

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
