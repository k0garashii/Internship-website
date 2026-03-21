import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { exchangeGoogleCodeForTokens, fetchGoogleUserInfo, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/email/google";
import {
  decodeGmailOauthStatePayload,
  type GmailOauthStatePayload,
} from "@/lib/email/gmail-oauth-state";
import { syncGmailMailbox } from "@/lib/email/gmail-sync";
import { upsertGmailConnectionFromGoogleOauth } from "@/lib/email/gmail-connection";
import { getRequestBaseUrl } from "@/lib/http/request-origin";
import { logRouteError, logRouteEvent } from "@/lib/observability/error-logging";

const callbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
});

function clearStateCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}

function buildRedirectUrl(baseUrl: string, statePayload: GmailOauthStatePayload | null) {
  const target = statePayload?.redirectTo?.startsWith("/") ? statePayload.redirectTo : "/workspace/email";
  return new URL(target, baseUrl);
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const baseUrl = getRequestBaseUrl(request);
  const params = callbackQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  const statePayload = decodeGmailOauthStatePayload(
    request.headers
      .get("cookie")
      ?.split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE}=`))
      ?.slice(GOOGLE_OAUTH_STATE_COOKIE.length + 1),
  );
  const redirectUrl = buildRedirectUrl(baseUrl, statePayload);

  if (!params.success) {
    redirectUrl.searchParams.set("gmail", "oauth-invalid-query");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearStateCookie());
    return response;
  }

  if (params.data.error) {
    redirectUrl.searchParams.set("gmail", "oauth-denied");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearStateCookie());
    return response;
  }

  if (!params.data.code || !params.data.state || !statePayload || params.data.state !== statePayload.nonce) {
    redirectUrl.searchParams.set("gmail", "oauth-invalid-state");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearStateCookie());
    return response;
  }

  const viewer = await getCurrentViewer();
  const userId = viewer?.userId ?? statePayload.userId;

  try {
    const tokens = await exchangeGoogleCodeForTokens(
      params.data.code,
      statePayload.redirectUri,
    );
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);
    await upsertGmailConnectionFromGoogleOauth({
      userId,
      scopeSet: statePayload.scopeSet,
      userInfo,
      tokens,
    });

    try {
      await syncGmailMailbox(userId);
    } catch (syncError) {
      logRouteError({
        level: "warn",
        route: "/api/email/google/callback",
        request,
        message: "Google OAuth succeeded but initial Gmail sync failed",
        error: syncError,
        status: 207,
      metadata: {
        userId,
      },
      });
      redirectUrl.searchParams.set("gmail", "connected-needs-sync");
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearStateCookie());
      return response;
    }

    logRouteEvent({
      route: "/api/email/google/callback",
      request,
      message: "Google OAuth callback completed successfully",
      status: 302,
      metadata: {
        userId,
        scopeSet: statePayload.scopeSet,
      },
    });

    redirectUrl.searchParams.set("gmail", "connected");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearStateCookie());
    return response;
  } catch (error) {
    logRouteError({
      route: "/api/email/google/callback",
      request,
      message: "Google OAuth callback failed",
      error,
      status: 500,
      metadata: {
        userId,
        scopeSet: statePayload.scopeSet,
      },
    });

    redirectUrl.searchParams.set("gmail", "oauth-error");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearStateCookie());
    return response;
  }
}
