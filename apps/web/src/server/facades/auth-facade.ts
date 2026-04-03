import { type SessionContext, prepareAuthSession } from "@/lib/auth/session";
import { ensureUserWorkspaceTx } from "@/server/application/workspace/workspace-service";
import { db } from "@/server/infrastructure/prisma/client";

export async function registerEmailPasswordUser(input: {
  email: string;
  fullName: string;
  passwordHash: string;
  sessionContext?: SessionContext;
}) {
  return db.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        passwordHash: input.passwordHash,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    const workspace = await ensureUserWorkspaceTx(tx, createdUser.id);

    await tx.userProfile.create({
      data: {
        userId: createdUser.id,
        workspaceId: workspace.workspaceId,
      },
    });

    const session = prepareAuthSession(createdUser.id, input.sessionContext);

    await tx.authSession.create({
      data: session.record,
    });

    return {
      user: createdUser,
      workspace,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  });
}

export async function issueViewerSession(input: {
  userId: string;
  email: string;
  fullName: string | null;
  sessionContext?: SessionContext;
}) {
  return db.$transaction(async (tx) => {
    await tx.authSession.deleteMany({
      where: {
        userId: input.userId,
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    const workspace = await ensureUserWorkspaceTx(tx, input.userId);
    const session = prepareAuthSession(input.userId, input.sessionContext);

    await tx.authSession.create({
      data: session.record,
    });

    return {
      user: {
        id: input.userId,
        email: input.email,
        fullName: input.fullName,
      },
      workspace,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  });
}
