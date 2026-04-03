import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { ensureUserWorkspace } from "@/server/application/workspace/workspace-service";

import { SESSION_COOKIE_NAME } from "./constants";
import type { AuthenticatedViewer } from "./viewer";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const inflightViewerResolutions = new Map<
  string,
  Promise<AuthenticatedViewer | null>
>();

export type SessionContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

export function prepareAuthSession(
  userId: string,
  context: SessionContext = {},
) {
  const token = createSessionToken();
  const expiresAt = buildSessionExpiry();

  return {
    token,
    expiresAt,
    record: {
      userId,
      sessionToken: hashSessionToken(token),
      expiresAt,
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    },
  };
}

export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function buildExpiredSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}

export function extractSessionContext(request: Request): SessionContext {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;
  const userAgent = request.headers.get("user-agent")?.slice(0, 512);

  return {
    ipAddress,
    userAgent,
  };
}

export async function getSessionTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function revokeSessionByToken(token: string | null | undefined) {
  if (!token) {
    return;
  }

  await db.authSession.deleteMany({
    where: {
      sessionToken: hashSessionToken(token),
    },
  });
}

async function resolveCurrentViewer(
  sessionToken: string,
): Promise<AuthenticatedViewer | null> {
  const now = new Date();

  await db.authSession.deleteMany({
    where: {
      OR: [
        {
          sessionToken: hashSessionToken(sessionToken),
          expiresAt: {
            lte: now,
          },
        },
        {
          expiresAt: {
            lte: now,
          },
        },
      ],
    },
  });

  const session = await db.authSession.findFirst({
    where: {
      sessionToken: hashSessionToken(sessionToken),
      expiresAt: {
        gt: now,
      },
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          email: true,
          fullName: true,
          activeWorkspaceId: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  const workspace = await ensureUserWorkspace(session.userId);

  return {
    userId: session.userId,
    sessionId: session.id,
    email: session.user.email,
    fullName: session.user.fullName ?? undefined,
    workspaceId: workspace.workspaceId,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    workspaceRole: workspace.role,
  };
}

export async function getCurrentViewer(): Promise<AuthenticatedViewer | null> {
  const sessionToken = await getSessionTokenFromCookies();

  if (!sessionToken) {
    return null;
  }

  const existingResolution = inflightViewerResolutions.get(sessionToken);

  if (existingResolution) {
    return existingResolution;
  }

  const resolution = resolveCurrentViewer(sessionToken).finally(() => {
    inflightViewerResolutions.delete(sessionToken);
  });

  inflightViewerResolutions.set(sessionToken, resolution);

  return resolution;
}
