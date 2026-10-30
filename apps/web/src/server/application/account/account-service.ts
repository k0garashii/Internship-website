import { WorkspaceMemberRole, WorkspaceType } from "@prisma/client";

import { verifyPassword } from "@/lib/auth/password";
import { disconnectGmailConnection } from "@/lib/email/gmail-connection";
import { logServiceError } from "@/lib/observability/error-logging";
import { db } from "@/server/infrastructure/prisma/client";

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

// Everything stored about the user, minus credentials (password hash, OAuth
// tokens, session hashes, webhook secrets) that must never leave the server.
export async function exportAccountData(userId: string) {
  const byUser = { where: { userId } };
  const [
    user,
    workspaceMemberships,
    authAccounts,
    sessions,
    profile,
    profileEnrichment,
    searchProfileInference,
    companyWatchlist,
    searchDomains,
    searchTargets,
    searchLocations,
    searchRuns,
    jobOffers,
    offerFeedback,
    searchBehaviorEvents,
    emailDrafts,
    emailDeliveryLogs,
    emailConnections,
    inboundEmails,
    mailboxMessages,
    mailboxSignals,
    jobs,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      omit: { passwordHash: true },
    }),
    db.workspaceMember.findMany({
      ...byUser,
      include: { workspace: { select: { id: true, name: true, slug: true, type: true } } },
    }),
    db.authAccount.findMany({
      ...byUser,
      omit: { accessToken: true, refreshToken: true, idToken: true },
    }),
    db.authSession.findMany({ ...byUser, omit: { sessionToken: true } }),
    db.userProfile.findUnique(byUser),
    db.userProfileEnrichment.findUnique(byUser),
    db.userSearchProfileInference.findUnique(byUser),
    db.companyWatchlistItem.findMany(byUser),
    db.searchDomain.findMany(byUser),
    db.searchTarget.findMany(byUser),
    db.searchLocation.findMany(byUser),
    db.searchRun.findMany(byUser),
    db.jobOffer.findMany(byUser),
    db.offerFeedback.findMany(byUser),
    db.searchBehaviorEvent.findMany(byUser),
    db.emailDraft.findMany(byUser),
    db.emailDeliveryLog.findMany(byUser),
    db.emailIngestionConnection.findMany({ ...byUser, omit: { webhookSecretHash: true } }),
    db.inboundEmail.findMany(byUser),
    db.mailboxMessage.findMany(byUser),
    db.offerMailboxSignal.findMany(byUser),
    db.appJob.findMany(byUser),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    workspaceMemberships,
    authAccounts,
    sessions,
    profile,
    profileEnrichment,
    searchProfileInference,
    companyWatchlist,
    searchDomains,
    searchTargets,
    searchLocations,
    searchRuns,
    jobOffers,
    offerFeedback,
    searchBehaviorEvents,
    emailDrafts,
    emailDeliveryLogs,
    emailConnections,
    inboundEmails,
    mailboxMessages,
    mailboxSignals,
    jobs,
  };
}

export async function deleteAccount(userId: string, password: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      passwordHash: true,
      workspaceMembers: {
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              type: true,
              personalOwnerUserId: true,
              _count: { select: { members: true } },
            },
          },
        },
      },
    },
  });

  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new AccountDeletionError("Mot de passe incorrect", 403);
  }

  const workspacesToDelete: string[] = [];

  for (const membership of user.workspaceMembers) {
    const { workspace } = membership;
    const isOwnPersonalWorkspace =
      workspace.type === WorkspaceType.PERSONAL && workspace.personalOwnerUserId === userId;

    if (isOwnPersonalWorkspace || workspace._count.members === 1) {
      workspacesToDelete.push(workspace.id);
      continue;
    }

    if (membership.role === WorkspaceMemberRole.OWNER) {
      const otherOwners = await db.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          role: WorkspaceMemberRole.OWNER,
          userId: { not: userId },
        },
      });

      if (otherOwners === 0) {
        throw new AccountDeletionError(
          "Tu es le seul propriétaire d’un workspace partagé : transfère d’abord ce rôle à un autre membre.",
          409,
        );
      }
    }
  }

  // Revoke Google access before the tokens disappear with the account.
  try {
    await disconnectGmailConnection(userId);
  } catch (error) {
    logServiceError({
      level: "warn",
      scope: "account/delete",
      message: "Gmail disconnect failed during account deletion",
      error,
      metadata: { userId },
    });
  }

  await db.$transaction([
    db.appJob.deleteMany({ where: { userId } }),
    db.workspaceInvitation.deleteMany({ where: { normalizedEmail: user.email.toLowerCase() } }),
    db.workspace.deleteMany({ where: { id: { in: workspacesToDelete } } }),
    db.user.delete({ where: { id: userId } }),
  ]);
}
