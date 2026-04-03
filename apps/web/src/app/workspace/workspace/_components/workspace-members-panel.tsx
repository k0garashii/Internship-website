"use client";

import { WorkspaceMemberRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Member = {
  userId: string;
  fullName: string | null;
  email: string;
  role: string;
  isDefault: boolean;
};

type Props = {
  viewerUserId: string;
  viewerRole: string | null;
  members: Member[];
};

const editableRoles = Object.values(WorkspaceMemberRole);

function canEditMember(
  viewerRole: string | null,
  member: Member,
  viewerUserId: string,
) {
  if (!viewerRole || (viewerRole !== "OWNER" && viewerRole !== "ADMIN")) {
    return false;
  }

  if (viewerUserId === member.userId) {
    return false;
  }

  if (viewerRole === "ADMIN" && (member.role === "OWNER")) {
    return false;
  }

  return true;
}

export function WorkspaceMembersPanel({ viewerUserId, viewerRole, members }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const handleRoleChange = (memberUserId: string, role: WorkspaceMemberRole) => {
    setError(null);
    setActiveUserId(memberUserId);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/workspace/members/${memberUserId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role }),
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to update role");
        }

        router.refresh();
      } catch (updateError) {
        setError(
          updateError instanceof Error ? updateError.message : "Unable to update role",
        );
      } finally {
        setActiveUserId(null);
      }
    });
  };

  return (
    <article className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
        Membres
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Membres actuellement rattaches
      </h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        Les roles peuvent maintenant etre ajustes depuis cet ecran pour preparer la
        vraie gestion d equipe.
      </p>

      <div className="mt-5 space-y-3">
        {members.map((member) => {
          const isEditable = canEditMember(viewerRole, member, viewerUserId);
          const isBusy = isPending && activeUserId === member.userId;

          return (
            <div
              key={member.userId}
              className="rounded-[1.25rem] border border-line bg-white/75 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {member.fullName ?? member.email}
                </p>
                {member.isDefault ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-700">
                    Defaut
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted">{member.email}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-[0.16em] text-muted">
                  Role
                </span>
                {isEditable ? (
                  <select
                    value={member.role}
                    disabled={isBusy}
                    onChange={(event) =>
                      handleRoleChange(
                        member.userId,
                        event.target.value as WorkspaceMemberRole,
                      )
                    }
                    className="rounded-full border border-line bg-white px-3 py-2 text-sm text-foreground"
                  >
                    {editableRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted">
                    {member.role}
                  </span>
                )}
              </div>
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
