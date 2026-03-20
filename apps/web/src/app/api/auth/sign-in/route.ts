import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { logRouteError } from "@/lib/observability/error-logging";
import { SignInUserError, signInUser } from "@/lib/auth/sign-in";
import {
  buildSessionCookieOptions,
  extractSessionContext,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/auth/sign-in",
      request,
      message: "Invalid JSON payload received during sign-in",
      error,
      status: 400,
    });

    return NextResponse.json(
      {
        error: "Invalid JSON payload",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const result = await signInUser(payload, extractSessionContext(request));
    const response = NextResponse.json(
      {
        redirectTo: redirectTo?.startsWith("/") ? redirectTo : "/workspace",
        user: result.user,
      },
      {
        status: 200,
      },
    );

    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.session.token,
      buildSessionCookieOptions(result.session.expiresAt),
    );

    return response;
  } catch (error) {
    if (error instanceof SignInUserError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/auth/sign-in",
        request,
        message: "Sign-in failed with a handled domain error",
        error,
        status: error.status,
      });

      return NextResponse.json(
        {
          error: error.message,
          fieldErrors: error.fieldErrors ?? {},
        },
        {
          status: error.status,
        },
      );
    }

    logRouteError({
      route: "/api/auth/sign-in",
      request,
      message: "Sign-in failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to sign in",
      },
      {
        status: 500,
      },
    );
  }
}
