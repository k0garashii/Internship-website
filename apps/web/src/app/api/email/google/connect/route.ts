import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { buildGoogleAuthUrl, GOOGLE_OAUTH_STATE_COOKIE, type GmailScopeSet, GoogleIntegrationError } from "@/lib/email/google";
import {
  createGmailOauthStatePayload,
  encodeGmailOauthStatePayload,
} from "@/lib/email/gmail-oauth-state";
import { getRequestBaseUrl } from "@/lib/http/request-origin";
import { logRouteError, logRouteEvent } from "@/lib/observability/error-logging";

const connectQuerySchema = z.object({
  scopeSet: z.enum(["mailbox", "mailbox_send"]).default("mailbox"),
  redirectTo: z.string().trim().min(1).optional(),
});

function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  };
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const baseUrl = getRequestBaseUrl(request);
  const viewer = await getCurrentViewer();

  if (!viewer) {
    const signInUrl = new URL("/sign-in", baseUrl);
    signInUrl.searchParams.set("redirectTo", "/workspace/email");
    return NextResponse.redirect(signInUrl);
  }

  const parsed = connectQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );

  const scopeSet: GmailScopeSet = parsed.success ? parsed.data.scopeSet : "mailbox";
  const redirectTo =
    parsed.success && parsed.data.redirectTo?.startsWith("/")
      ? parsed.data.redirectTo
      : "/workspace/email";
  const redirectUri = new URL("/api/email/google/callback", baseUrl).toString();

  try {
    const statePayload = createGmailOauthStatePayload({
      userId: viewer.userId,
      scopeSet,
      redirectTo,
      redirectUri,
    });
    const redirectUrl = buildGoogleAuthUrl({
      scopeSet,
      state: statePayload.nonce,
      redirectUri,
    });
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(
      GOOGLE_OAUTH_STATE_COOKIE,
      encodeGmailOauthStatePayload(statePayload),
      buildCookieOptions(),
    );

    logRouteEvent({
      route: "/api/email/google/connect",
      request,
      message: "Google OAuth redirect initialized",
      status: 302,
      metadata: {
        userId: viewer.userId,
        scopeSet,
      },
    });

    return response;
  } catch (error) {
    if (error instanceof GoogleIntegrationError) {
      const fallbackUrl = new URL(redirectTo, baseUrl);
      fallbackUrl.searchParams.set("gmail", "oauth-missing-config");
      return NextResponse.redirect(fallbackUrl);
    }

    logRouteError({
      route: "/api/email/google/connect",
      request,
      message: "Failed to initialize Google OAuth redirect",
      error,
      status: 500,
      metadata: {
        userId: viewer.userId,
        scopeSet,
      },
    });

    const fallbackUrl = new URL(redirectTo, baseUrl);
    fallbackUrl.searchParams.set("gmail", "oauth-error");
    return NextResponse.redirect(fallbackUrl);
  }
}
