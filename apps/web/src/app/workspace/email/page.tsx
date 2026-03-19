import { getCurrentViewer } from "@/lib/auth/session";
import { getForwardingSourceSnapshot } from "@/lib/email/forwarding";
import { EmailForwardingPanel } from "./_components/email-forwarding-panel";

export default async function EmailWorkspacePage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const snapshot = await getForwardingSourceSnapshot(viewer);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
          Ingestion email
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Connecter un forwarding dedie.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted md:text-lg">
          Cette etape ajoute une voie d entree serveur pour les alertes emploi,
          emails recruteurs et messages campus. Le MVP actuel priorise un forwarding
          dedie sans OAuth complet pour garder un perimetre simple et controle.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Etat actuel
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">Forwarding configure</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {snapshot.configured ? "Oui" : "Non"}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">Adresse dediee</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {snapshot.supportsDedicatedAddress ? "Disponible" : "Domaine manquant"}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Portee du MVP
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-foreground">
            <li>Provisionner un point d ingestion serveur pour des emails d opportunites.</li>
            <li>Generer un identifiant de forwarding par utilisateur et un secret de webhook.</li>
            <li>Recevoir puis stocker les messages entrants avec metadonnees utiles et premier signal.</li>
            <li>Laisser le parsing fin vers opportunites structurees a la tache suivante.</li>
          </ul>
        </article>
      </section>

      <EmailForwardingPanel initialSnapshot={snapshot} />
    </main>
  );
}
