type Props = {
  providerHealth: {
    googleOauth: {
      configured: boolean;
      clientIdPresent: boolean;
      clientSecretPresent: boolean;
      redirectUri: string;
      appBaseUrl: string;
    };
    gmail: {
      connected: boolean;
      hasMailboxScope: boolean;
      hasSendScope: boolean;
      lastSyncedAt: string | null;
      lastSyncError: string | null;
    };
    billing: {
      provider: string | null;
      configured: boolean;
      status: string | null;
      planCode: string | null;
      planName: string | null;
      note: string;
    };
    jobs: {
      pendingCount: number;
      runningCount: number;
      failedCount: number;
    };
  };
};

function HealthBadge({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className={
        ok
          ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-emerald-800"
          : "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-900"
      }
    >
      {label}
    </span>
  );
}

export function WorkspaceProviderHealthPanel({ providerHealth }: Props) {
  return (
    <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
        Connexions
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Services relies a l espace
      </h2>

      <div className="mt-5 space-y-4">
        <div className="rounded-[1.25rem] border border-line bg-white/75 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">Google OAuth</p>
            <HealthBadge
              ok={providerHealth.googleOauth.configured}
              label={providerHealth.googleOauth.configured ? "Configure" : "Incomplet"}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            Base URL: {providerHealth.googleOauth.appBaseUrl}
          </p>
          <p className="mt-1 text-xs text-muted">
            URL de retour: {providerHealth.googleOauth.redirectUri}
          </p>
        </div>

        <div className="rounded-[1.25rem] border border-line bg-white/75 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">Connexion Gmail</p>
            <HealthBadge
              ok={providerHealth.gmail.connected}
              label={providerHealth.gmail.connected ? "Connectee" : "Absente"}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            Lecture: {providerHealth.gmail.hasMailboxScope ? "active" : "inactive"} • Envoi:{" "}
            {providerHealth.gmail.hasSendScope ? "active" : "inactive"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {providerHealth.gmail.lastSyncError
              ? `Derniere erreur: ${providerHealth.gmail.lastSyncError}`
              : `Derniere synchro: ${providerHealth.gmail.lastSyncedAt ?? "jamais"}`}
          </p>
        </div>

        <div className="rounded-[1.25rem] border border-line bg-white/75 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">Abonnement</p>
            <HealthBadge
              ok={providerHealth.billing.configured}
              label={providerHealth.billing.configured ? "Pret" : "A brancher"}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {providerHealth.billing.planName ?? "Aucun plan"} •{" "}
            {providerHealth.billing.status ?? "statut inconnu"}
          </p>
          <p className="mt-1 text-xs text-muted">{providerHealth.billing.note}</p>
        </div>

        <div className="rounded-[1.25rem] border border-line bg-white/75 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">Jobs applicatifs</p>
            <HealthBadge
              ok={providerHealth.jobs.failedCount === 0}
              label={providerHealth.jobs.failedCount === 0 ? "Sain" : "A surveiller"}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            En attente {providerHealth.jobs.pendingCount} • En cours {providerHealth.jobs.runningCount} • En erreur{" "}
            {providerHealth.jobs.failedCount}
          </p>
        </div>
      </div>
    </article>
  );
}
