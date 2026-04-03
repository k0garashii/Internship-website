"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AccessibleWorkspace = {
  workspaceId: string;
  slug: string;
  name: string;
  role: string;
  isActive: boolean;
  isDefault: boolean;
};

type Props = {
  currentWorkspace: {
    workspaceId: string;
    slug: string | null;
    name: string | null;
    role: string | null;
  };
  accessibleWorkspaces: AccessibleWorkspace[];
};

export function WorkspaceSwitcher({ currentWorkspace, accessibleWorkspaces }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (workspaceId: string) => {
    setError(null);
    setPendingWorkspaceId(workspaceId);

    startTransition(async () => {
      try {
        const response = await fetch("/api/workspace/active", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId,
          }),
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to switch workspace");
        }

        router.refresh();
      } catch (switchError) {
        setError(
          switchError instanceof Error
            ? switchError.message
            : "Unable to switch workspace",
        );
      } finally {
        setPendingWorkspaceId(null);
      }
    });
  };

  return (
    <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
        Workspace actif
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Basculer entre les espaces accessibles
      </h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        Le produit reste aujourd hui centré sur un workspace personnel, mais le
        switcher est déjà prêt pour le multi-espace.
      </p>

      <div className="mt-5 rounded-[1.25rem] border border-line bg-white/70 p-4">
        <p className="text-sm text-muted">Selection courante</p>
        <p className="mt-2 text-lg font-medium text-foreground">
          {currentWorkspace.name ?? "Workspace actif"}
        </p>
        <p className="mt-1 text-xs text-muted">
          /{currentWorkspace.slug ?? "workspace"} • {currentWorkspace.role ?? "role inconnu"}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {accessibleWorkspaces.map((workspace) => {
          const isBusy = isPending && pendingWorkspaceId === workspace.workspaceId;

          return (
            <div
              key={workspace.workspaceId}
              className="flex flex-col gap-3 rounded-[1.25rem] border border-line bg-white/75 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{workspace.name}</p>
                <p className="mt-1 text-xs text-muted">
                  /{workspace.slug} • {workspace.role}
                  {workspace.isDefault ? " • par defaut" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={workspace.isActive || isBusy}
                onClick={() => handleSwitch(workspace.workspaceId)}
                className={
                  workspace.isActive
                    ? "rounded-full border border-line px-4 py-2 text-sm text-muted"
                    : "rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                }
              >
                {workspace.isActive ? "Actif" : isBusy ? "Bascule..." : "Activer"}
              </button>
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </article>
  );
}
