import { NextResponse } from "next/server";

import { RegisterUserError, registerUser } from "@/lib/auth/register";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { logRouteError, logRouteEvent } from "@/lib/observability/error-logging";
import {
  buildSessionCookieOptions,
  extractSessionContext,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logRouteError({
      level: "warn",
      route: "/api/auth/register",
      request,
      message: "Invalid JSON payload received during registration",
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
    const result = await registerUser(payload, extractSessionContext(request));
    const response = NextResponse.json(
      {
        redirectTo: "/workspace",
        user: result.user,
      },
      {
        status: 201,
      },
    );

    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.session.token,
      buildSessionCookieOptions(result.session.expiresAt),
    );

    logRouteEvent({
      route: "/api/auth/register",
      request,
      message: "Registration completed",
      status: 201,
      metadata: {
        userId: result.user.id,
        email: result.user.email,
      },
    });

    return response;
  } catch (error) {
    if (error instanceof RegisterUserError) {
      logRouteError({
        level: error.status >= 500 ? "error" : "warn",
        route: "/api/auth/register",
        request,
        message: "Registration failed with a handled domain error",
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
      route: "/api/auth/register",
      request,
      message: "Registration failed with an unexpected error",
      error,
      status: 500,
    });

    return NextResponse.json(
      {
        error: "Unable to create account",
      },
      {
        status: 500,
      },
    );
  }
}
