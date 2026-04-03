import { getCurrentViewer } from "@/lib/auth/session";
import { getWorkspaceControlCenter } from "@/server/facades/workspace-facade";

import { WorkspaceMembersPanel } from "./_components/workspace-members-panel";
import { WorkspaceInvitationsPanel } from "./_components/workspace-invitations-panel";
import { WorkspaceProviderHealthPanel } from "./_components/workspace-provider-health-panel";
import { WorkspaceSwitcher } from "./_components/workspace-switcher";

export default async function WorkspaceControlPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return null;
  }

  const snapshot = await getWorkspaceControlCenter(viewer);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">Workspace</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Pilotage de l espace SaaS.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          Cette page centralise le workspace actif, les membres, le plan courant et
          les connexions utiles de l espace. Aujourd hui tu n as sans doute qu un
          seul workspace personnel, mais l interface est prete pour la suite.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <WorkspaceSwitcher
          currentWorkspace={snapshot.currentWorkspace}
          accessibleWorkspaces={snapshot.accessibleWorkspaces}
        />
        <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Plan et acces
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Etat commercial courant
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">Plan</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {snapshot.commercial.billing.planName ?? "Non defini"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {snapshot.commercial.billing.planCode ?? "Aucun code"}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-line bg-white/70 p-4">
              <p className="text-sm text-muted">Statut abonnement</p>
              <p className="mt-2 text-lg font-medium text-foreground">
                {snapshot.commercial.billing.status ?? "Inconnu"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Service {snapshot.providerHealth.billing.provider ?? "non relie"}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <WorkspaceMembersPanel
          viewerUserId={viewer.userId}
          viewerRole={viewer.workspaceRole ?? null}
          members={snapshot.members}
        />
        <WorkspaceProviderHealthPanel providerHealth={snapshot.providerHealth} />
      </section>

      <section>
        <WorkspaceInvitationsPanel
          viewerRole={viewer.workspaceRole ?? null}
          invitations={snapshot.invitations}
        />
      </section>
    </main>
  );
}
