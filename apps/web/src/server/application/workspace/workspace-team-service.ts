import { randomBytes } from "node:crypto";

import {
  Prisma,
  WorkspaceInvitationStatus,
  WorkspaceMemberRole,
} from "@prisma/client";

import { db } from "@/server/infrastructure/prisma/client";
import {
  canEditWorkspaceMemberRole,
  canInviteToWorkspace,
} from "@/server/domain/authz/workspace-roles";

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export class WorkspaceTeamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorkspaceTeamError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildInvitationToken() {
  return randomBytes(24).toString("base64url");
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || "http://127.0.0.1:3000";
}

function buildInvitationLink(token: string) {
  return new URL(`/accept-invitation?token=${encodeURIComponent(token)}`, getAppBaseUrl()).toString();
}

export async function listWorkspaceInvitations(workspaceId: string) {
  const invitations = await db.workspaceInvitation.findMany({
    where: {
      workspaceId,
      status: WorkspaceInvitationStatus.PENDING,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      token: true,
      expiresAt: true,
      invitedByUser: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    invitedBy:
      invitation.invitedByUser?.fullName ?? invitation.invitedByUser?.email ?? null,
    inviteLink: buildInvitationLink(invitation.token),
  }));
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceMemberRole | null | undefined;
  email: string;
  role: WorkspaceMemberRole;
}) {
  if (!canInviteToWorkspace(input.actorRole)) {
    throw new WorkspaceTeamError("You are not allowed to invite members", 403);
  }

  const normalizedEmail = normalizeEmail(input.email);

  const existingMember = await db.workspaceMember.findFirst({
    where: {
      workspaceId: input.workspaceId,
      user: {
        email: normalizedEmail,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingMember) {
    throw new WorkspaceTeamError("This user is already a member of the workspace", 409);
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const invitation = await db.workspaceInvitation.upsert({
    where: {
      workspaceId_normalizedEmail_status: {
        workspaceId: input.workspaceId,
        normalizedEmail,
        status: WorkspaceInvitationStatus.PENDING,
      },
    },
    update: {
      email: normalizedEmail,
      role: input.role,
      invitedByUserId: input.actorUserId,
      expiresAt,
      token: buildInvitationToken(),
    },
    create: {
      workspaceId: input.workspaceId,
      invitedByUserId: input.actorUserId,
      email: normalizedEmail,
      normalizedEmail,
      role: input.role,
      token: buildInvitationToken(),
      expiresAt,
      status: WorkspaceInvitationStatus.PENDING,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      token: true,
      expiresAt: true,
    },
  });

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    inviteLink: buildInvitationLink(invitation.token),
  };
}

export async function revokeWorkspaceInvitation(input: {
  workspaceId: string;
  actorRole: WorkspaceMemberRole | null | undefined;
  invitationId: string;
}) {
  if (!canInviteToWorkspace(input.actorRole)) {
    throw new WorkspaceTeamError("You are not allowed to revoke invitations", 403);
  }

  const invitation = await db.workspaceInvitation.findFirst({
    where: {
      id: input.invitationId,
      workspaceId: input.workspaceId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!invitation) {
    throw new WorkspaceTeamError("Invitation not found", 404);
  }

  if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
    throw new WorkspaceTeamError("Invitation is no longer pending", 409);
  }

  await db.workspaceInvitation.update({
    where: {
      id: invitation.id,
    },
    data: {
      status: WorkspaceInvitationStatus.REVOKED,
      revokedAt: new Date(),
    },
  });
}

export async function acceptWorkspaceInvitation(input: {
  token: string;
  userId: string;
  userEmail: string;
}) {
  const normalizedEmail = normalizeEmail(input.userEmail);

  const invitation = await db.workspaceInvitation.findUnique({
    where: {
      token: input.token,
    },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      normalizedEmail: true,
      role: true,
      status: true,
      expiresAt: true,
      workspace: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new WorkspaceTeamError("Invitation not found", 404);
  }

  if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
    throw new WorkspaceTeamError("Invitation is no longer pending", 409);
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    await db.workspaceInvitation.update({
      where: {
        id: invitation.id,
      },
      data: {
        status: WorkspaceInvitationStatus.EXPIRED,
      },
    });

    throw new WorkspaceTeamError("Invitation has expired", 410);
  }

  if (invitation.normalizedEmail !== normalizedEmail) {
    throw new WorkspaceTeamError("Invitation email does not match the signed-in user", 403);
  }

  await db.$transaction(async (tx) => {
    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: input.userId,
        },
      },
      update: {
        role: invitation.role,
      },
      create: {
        workspaceId: invitation.workspaceId,
        userId: input.userId,
        role: invitation.role,
        isDefault: false,
      },
    });

    await tx.workspaceInvitation.update({
      where: {
        id: invitation.id,
      },
      data: {
        status: WorkspaceInvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    await tx.user.update({
      where: {
        id: input.userId,
      },
      data: {
        activeWorkspaceId: invitation.workspaceId,
      },
    });
  });

  return {
    workspaceId: invitation.workspace.id,
    workspaceSlug: invitation.workspace.slug,
    workspaceName: invitation.workspace.name,
    role: invitation.role,
  };
}

export async function updateWorkspaceMemberRole(input: {
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceMemberRole | null | undefined;
  memberUserId: string;
  nextRole: WorkspaceMemberRole;
}) {
  const member = await db.workspaceMember.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: input.memberUserId,
    },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  });

  if (!member) {
    throw new WorkspaceTeamError("Member not found", 404);
  }

  if (
    !canEditWorkspaceMemberRole({
      actorRole: input.actorRole,
      targetRole: member.role,
      nextRole: input.nextRole,
      isSelf: input.actorUserId === member.user.id,
    })
  ) {
    throw new WorkspaceTeamError("You are not allowed to change this role", 403);
  }

  if (member.role === input.nextRole) {
    return {
      userId: member.user.id,
      email: member.user.email,
      fullName: member.user.fullName,
      role: member.role,
    };
  }

  const ownerCount =
    member.role === WorkspaceMemberRole.OWNER
      ? await db.workspaceMember.count({
          where: {
            workspaceId: input.workspaceId,
            role: WorkspaceMemberRole.OWNER,
          },
        })
      : null;

  if (
    member.role === WorkspaceMemberRole.OWNER &&
    input.nextRole !== WorkspaceMemberRole.OWNER &&
    ownerCount !== null &&
    ownerCount <= 1
  ) {
    throw new WorkspaceTeamError("At least one owner must remain on the workspace", 409);
  }

  const updated = await db.workspaceMember.update({
    where: {
      id: member.id,
    },
    data: {
      role: input.nextRole,
    },
    select: {
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  });

  return {
    userId: updated.user.id,
    email: updated.user.email,
    fullName: updated.user.fullName,
    role: updated.role,
  };
}

export async function getInvitationPreview(token: string) {
  const invitation = await db.workspaceInvitation.findUnique({
    where: {
      token,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      workspace: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!invitation) {
    return null;
  }

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    workspaceName: invitation.workspace.name,
    workspaceSlug: invitation.workspace.slug,
    isExpired: invitation.expiresAt.getTime() <= Date.now(),
  };
}
