import { type WorkspaceMemberRole } from "@prisma/client";

import { db } from "@/server/infrastructure/prisma/client";

export type AccessibleWorkspace = {
  workspaceId: string;
  slug: string;
  name: string;
  role: WorkspaceMemberRole;
  isActive: boolean;
  isDefault: boolean;
};

export type WorkspaceMemberSummary = {
  userId: string;
  fullName: string | null;
  email: string;
  role: WorkspaceMemberRole;
  isDefault: boolean;
};

export async function listAccessibleWorkspacesForUser(userId: string) {
  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      activeWorkspaceId: true,
      workspaceMembers: {
        orderBy: [
          {
            isDefault: "desc",
          },
          {
            createdAt: "asc",
          },
        ],
        select: {
          role: true,
          isDefault: true,
          workspace: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return [] as AccessibleWorkspace[];
  }

  return user.workspaceMembers.map((membership) => ({
    workspaceId: membership.workspace.id,
    slug: membership.workspace.slug,
    name: membership.workspace.name,
    role: membership.role,
    isActive: membership.workspace.id === user.activeWorkspaceId,
    isDefault: membership.isDefault,
  }));
}

export async function switchActiveWorkspaceForUser(userId: string, workspaceId: string) {
  const membership = await db.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
    },
    select: {
      workspace: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      role: true,
    },
  });

  if (!membership) {
    return null;
  }

  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      activeWorkspaceId: workspaceId,
    },
  });

  return {
    workspaceId: membership.workspace.id,
    slug: membership.workspace.slug,
    name: membership.workspace.name,
    role: membership.role,
  };
}

export async function listWorkspaceMembersDetailed(workspaceId: string) {
  const members = await db.workspaceMember.findMany({
    where: {
      workspaceId,
    },
    orderBy: [
      {
        role: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      role: true,
      isDefault: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  return members.map((member) => ({
    userId: member.user.id,
    fullName: member.user.fullName,
    email: member.user.email,
    role: member.role,
    isDefault: member.isDefault,
  })) satisfies WorkspaceMemberSummary[];
}
