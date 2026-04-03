import { Prisma, WorkspaceMemberRole, WorkspaceType, type Prisma as PrismaTypes } from "@prisma/client";

import {
  ensureWorkspaceBillingBootstrapTx,
  recordBillingEventTx,
} from "@/server/application/billing/billing-service";
import { db } from "@/server/infrastructure/prisma/client";

type TxClient = PrismaTypes.TransactionClient;

export type WorkspaceContext = {
  workspaceId: string;
  slug: string;
  name: string;
  role: WorkspaceMemberRole;
};

type WorkspaceSelection = {
  id: string;
  slug: string;
  name: string;
  type: WorkspaceType;
  personalOwnerUserId: string | null;
};

async function ensurePersonalWorkspaceOwnershipTx(
  tx: TxClient,
  workspace: WorkspaceSelection,
  userId: string,
) {
  if (
    workspace.type !== WorkspaceType.PERSONAL ||
    workspace.personalOwnerUserId === userId
  ) {
    return;
  }

  await tx.workspace.updateMany({
    where: {
      id: workspace.id,
      personalOwnerUserId: null,
    },
    data: {
      personalOwnerUserId: userId,
    },
  });
}

function slugifyWorkspaceValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function buildWorkspaceBaseName(user: {
  id: string;
  fullName: string | null;
  email: string;
}) {
  return user.fullName?.trim() || user.email.split("@")[0] || "workspace";
}

function buildWorkspaceName(user: {
  id: string;
  fullName: string | null;
  email: string;
}) {
  const baseName = buildWorkspaceBaseName(user);
  return `${baseName} Workspace`.slice(0, 120);
}

async function buildUniqueWorkspaceSlugTx(
  tx: TxClient,
  user: {
    id: string;
    fullName: string | null;
    email: string;
  },
) {
  const fallbackSlug = user.email.split("@")[0] || "workspace";
  const readableBaseSlug =
    slugifyWorkspaceValue(buildWorkspaceBaseName(user)) || `workspace-${fallbackSlug}`;
  const userSuffix = user.id.slice(-8).toLowerCase();
  const baseSlug = `${readableBaseSlug.slice(0, 39)}-${userSuffix}`.replace(/-+/g, "-");
  let candidate = baseSlug;
  let index = 2;

  while (await tx.workspace.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }

  return candidate;
}

async function getExistingWorkspaceContextTx(
  tx: TxClient,
  userId: string,
): Promise<WorkspaceContext | null> {
  const user = await tx.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      activeWorkspace: {
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          personalOwnerUserId: true,
        },
      },
      workspaceMembers: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              slug: true,
              name: true,
              type: true,
              personalOwnerUserId: true,
            },
          },
        },
      },
    },
  });

  const activeWorkspace = user?.activeWorkspace ?? user?.workspaceMembers[0]?.workspace;
  const role = user?.workspaceMembers[0]?.role ?? WorkspaceMemberRole.OWNER;

  if (!activeWorkspace) {
    return null;
  }

  await ensurePersonalWorkspaceOwnershipTx(tx, activeWorkspace, userId);

  await backfillWorkspaceRelationsTx(tx, {
    userId,
    workspaceId: activeWorkspace.id,
  });

  if (!user?.activeWorkspace) {
    await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        activeWorkspaceId: activeWorkspace.id,
      },
    });
  }

  return {
    workspaceId: activeWorkspace.id,
    slug: activeWorkspace.slug,
    name: activeWorkspace.name,
    role,
  };
}

async function backfillWorkspaceRelationsTx(
  tx: TxClient,
  input: {
    userId: string;
    workspaceId: string;
  },
) {
  const { userId, workspaceId } = input;

  await Promise.all([
    tx.userProfile.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.userProfileEnrichment.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.companyWatchlistItem.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.searchDomain.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.searchTarget.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.searchLocation.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.searchRun.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.jobOffer.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.offerFeedback.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.emailDraft.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.emailDeliveryLog.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.emailIngestionConnection.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.inboundEmail.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.mailboxMessage.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.offerMailboxSignal.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
    tx.appJob.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId },
    }),
  ]);
}

export async function ensureUserWorkspaceTx(
  tx: TxClient,
  userId: string,
): Promise<WorkspaceContext> {
  const user = await tx.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      locale: true,
      timezone: true,
      activeWorkspace: {
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          personalOwnerUserId: true,
        },
      },
      workspaceMembers: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              slug: true,
              name: true,
              type: true,
              personalOwnerUserId: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found while resolving workspace");
  }

  if (user.activeWorkspace) {
    await ensurePersonalWorkspaceOwnershipTx(tx, user.activeWorkspace, userId);

    await backfillWorkspaceRelationsTx(tx, {
      userId,
      workspaceId: user.activeWorkspace.id,
    });

    return {
      workspaceId: user.activeWorkspace.id,
      slug: user.activeWorkspace.slug,
      name: user.activeWorkspace.name,
      role: user.workspaceMembers[0]?.role ?? WorkspaceMemberRole.OWNER,
    };
  }

  const fallbackMembership = user.workspaceMembers[0];
  if (fallbackMembership) {
    await ensurePersonalWorkspaceOwnershipTx(tx, fallbackMembership.workspace, userId);

    await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        activeWorkspaceId: fallbackMembership.workspace.id,
      },
    });

    await backfillWorkspaceRelationsTx(tx, {
      userId,
      workspaceId: fallbackMembership.workspace.id,
    });

    return {
      workspaceId: fallbackMembership.workspace.id,
      slug: fallbackMembership.workspace.slug,
      name: fallbackMembership.workspace.name,
      role: fallbackMembership.role,
    };
  }

  const slug = await buildUniqueWorkspaceSlugTx(tx, user);
  const workspace = await tx.workspace.upsert({
    where: {
      personalOwnerUserId: userId,
    },
    update: {},
    create: {
      slug,
      name: buildWorkspaceName(user),
      type: WorkspaceType.PERSONAL,
      createdByUserId: userId,
      personalOwnerUserId: userId,
      defaultLocale: user.locale,
      defaultTimezone: user.timezone,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  await tx.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
    update: {
      role: WorkspaceMemberRole.OWNER,
      isDefault: true,
    },
    create: {
      workspaceId: workspace.id,
      userId,
      role: WorkspaceMemberRole.OWNER,
      isDefault: true,
    },
  });

  const plan = await ensureWorkspaceBillingBootstrapTx(tx, workspace.id);

  await tx.user.update({
    where: {
      id: userId,
    },
    data: {
      activeWorkspaceId: workspace.id,
    },
  });

  await backfillWorkspaceRelationsTx(tx, {
    userId,
    workspaceId: workspace.id,
  });

  const existingProvisionEvent = await tx.billingEvent.findFirst({
    where: {
      workspaceId: workspace.id,
      eventType: "workspace.provisioned",
    },
    select: {
      id: true,
    },
  });

  if (!existingProvisionEvent) {
    await recordBillingEventTx(tx, {
      workspaceId: workspace.id,
      actorUserId: userId,
      eventType: "workspace.provisioned",
      payload: {
        planCode: plan.code,
        workspaceType: WorkspaceType.PERSONAL,
      },
    });
  }

  return {
    workspaceId: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    role: WorkspaceMemberRole.OWNER,
  };
}

export async function ensureUserWorkspace(userId: string) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.$transaction((tx) => ensureUserWorkspaceTx(tx, userId));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const recovered = await db.$transaction((tx) =>
          getExistingWorkspaceContextTx(tx, userId),
        );

        if (recovered) {
          return recovered;
        }

        if (attempt < maxAttempts) {
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error("Workspace resolution failed unexpectedly");
}

export async function getRequiredActiveWorkspaceIdForUser(userId: string) {
  const workspace = await ensureUserWorkspace(userId);
  return workspace.workspaceId;
}
