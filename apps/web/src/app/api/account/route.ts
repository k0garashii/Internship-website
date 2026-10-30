import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { buildExpiredSessionCookieOptions, getCurrentViewer } from "@/lib/auth/session";
import { logRouteError, logRouteEvent } from "@/lib/observability/error-logging";
import {
  buildRateLimitKey,
  buildRateLimitResponseInit,
  enforceRateLimits,
  RateLimitExceededError,
} from "@/lib/security/rate-limit";
import {
  AccountDeletionError,
  deleteAccount,
} from "@/server/application/account/account-service";

export const runtime = "nodejs";

const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});

export async function DELETE(request: Request) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json(
      {
        error: "Authentication required",
      },
      {
        status: 401,
      },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const parsed = deleteAccountSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Mot de passe requis",
      },
      {
        status: 400,
      },
    );
  }

  try {
    await enforceRateLimits([
      {
        key: buildRateLimitKey("account-delete:user", viewer.userId),
        limit: 5,
        windowMs: 15 * 60 * 1000,
      },
    ]);

    await deleteAccount(viewer.userId, parsed.data.password);

    logRouteEvent({
      route: "/api/account",
      request,
      message: "Account deleted",
      status: 200,
      metadata: {
        userId: viewer.userId,
      },
    });

    const response = NextResponse.json(
      {
        redirectTo: "/",
      },
      {
        status: 200,
      },
    );

    response.cookies.set(SESSION_COOKIE_NAME, "", buildExpiredSessionCookieOptions());

    return response;
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        {
          error: "Trop de tentatives. Réessaie plus tard.",
        },
        buildRateLimitResponseInit(error),
      );
    }

    if (error instanceof AccountDeletionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    logRouteError({
      route: "/api/account",
      request,
      message: "Account deletion failed",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
      },
    });

    return NextResponse.json(
      {
        error: "Impossible de supprimer le compte",
      },
      {
        status: 500,
      },
    );
  }
}
