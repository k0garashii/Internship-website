"use client";

import { WorkspaceMemberRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  invitedBy: string | null;
  inviteLink: string;
};

type Props = {
  viewerRole: string | null;
  invitations: Invitation[];
};

const inviteRoles = [
  WorkspaceMemberRole.ADMIN,
  WorkspaceMemberRole.MEMBER,
  WorkspaceMemberRole.BILLING,
] as const;

function canManageInvitations(viewerRole: string | null) {
  return viewerRole === "OWNER" || viewerRole === "ADMIN";
}

export function WorkspaceInvitationsPanel({ viewerRole, invitations }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMemberRole>(WorkspaceMemberRole.MEMBER);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const manageable = canManageInvitations(viewerRole);

  const handleInvite = () => {
    if (!manageable) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/workspace/invitations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, role }),
        });

        const payload = (await response.json()) as {
          error?: string;
          invitation?: { inviteLink: string };
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to create invitation");
        }

        setEmail("");
        setSuccess(payload.invitation?.inviteLink ?? "Invitation created");
        router.refresh();
      } catch (inviteError) {
        setError(
          inviteError instanceof Error
            ? inviteError.message
            : "Unable to create invitation",
        );
      }
    });
  };

  const handleRevoke = (invitationId: string) => {
    if (!manageable) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/workspace/invitations/${invitationId}`, {
          method: "DELETE",
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to revoke invitation");
        }

        router.refresh();
      } catch (revokeError) {
        setError(
          revokeError instanceof Error
            ? revokeError.message
            : "Unable to revoke invitation",
        );
      }
    });
  };

  const handleCopy = async (inviteLink: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccess(inviteLink);
    } catch {
      setError("Unable to copy invitation link");
    }
  };

  return (
    <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
        Invitations
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Inviter un membre sur le workspace
      </h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        L invitation genere un lien partageable. Le membre accepte ensuite en se
        connectant avec l adresse mail invitee.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input
          type="email"
          value={email}
          disabled={!manageable || isPending}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="collegue@example.com"
          className="rounded-[1rem] border border-line bg-white px-4 py-3 text-sm text-foreground"
        />
        <select
          value={role}
          disabled={!manageable || isPending}
          onChange={(event) => setRole(event.target.value as WorkspaceMemberRole)}
          className="rounded-[1rem] border border-line bg-white px-4 py-3 text-sm text-foreground"
        >
          {inviteRoles.map((inviteRole) => (
            <option key={inviteRole} value={inviteRole}>
              {inviteRole}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!manageable || isPending || email.trim().length === 0}
          onClick={handleInvite}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {isPending ? "Creation..." : "Inviter"}
        </button>
      </div>

      {!manageable ? (
        <p className="mt-4 text-sm text-muted">
          Seuls les owners et admins peuvent gerer les invitations.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 text-sm text-emerald-700">
          Lien d invitation: {success}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="rounded-[1.25rem] border border-line bg-white/75 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{invitation.email}</p>
              <span className="rounded-full border border-line px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted">
                {invitation.role}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Expire le {new Date(invitation.expiresAt).toLocaleString("fr-FR")}
              {invitation.invitedBy ? ` • invite par ${invitation.invitedBy}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleCopy(invitation.inviteLink)}
                className="rounded-full border border-line px-4 py-2 text-sm text-foreground"
              >
                Copier le lien
              </button>
              {manageable ? (
                <button
                  type="button"
                  onClick={() => handleRevoke(invitation.id)}
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700"
                >
                  Revoquer
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
