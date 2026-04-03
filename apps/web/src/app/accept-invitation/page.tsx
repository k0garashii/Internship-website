import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/lib/auth/session";
import { getInvitationSnapshot } from "@/server/facades/workspace-facade";

import { AcceptInvitationButton } from "./_components/accept-invitation-button";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const viewer = await getCurrentViewer();

  if (!token) {
    redirect("/workspace");
  }

  const signInHref = `/sign-in?redirectTo=${encodeURIComponent(
    `/accept-invitation?token=${token}`,
  )}`;

  const invitation = await getInvitationSnapshot(token);

  if (!invitation) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <div className="rounded-[1.75rem] border border-line bg-card p-8 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Invitation
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
            Invitation introuvable
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Le lien d invitation n existe plus ou n est pas valide.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <div className="rounded-[1.75rem] border border-line bg-card p-8 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
          Invitation workspace
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Rejoindre {invitation.workspaceName}
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Cette invitation donne acces au workspace <strong>{invitation.workspaceSlug}</strong>{" "}
          avec le role <strong>{invitation.role}</strong>.
        </p>
        <p className="mt-2 text-sm leading-7 text-muted">
          Adresse invitee: <strong>{invitation.email}</strong>
        </p>

        {!viewer ? (
          <div className="mt-6 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Connecte-toi d abord avec l adresse invitee, puis reviens sur ce lien.
          </div>
        ) : null}

        {invitation.isExpired || invitation.status !== "PENDING" ? (
          <div className="mt-6 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Cette invitation n est plus acceptables dans son etat actuel.
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {viewer && invitation.status === "PENDING" && !invitation.isExpired ? (
            <AcceptInvitationButton token={token} />
          ) : null}
          <Link
            href={viewer ? "/workspace/workspace" : signInHref}
            className="rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground"
          >
            {viewer ? "Retour au workspace" : "Se connecter"}
          </Link>
        </div>
      </div>
    </main>
  );
}
