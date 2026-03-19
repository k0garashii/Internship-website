import { NextResponse } from "next/server";

import { RegisterUserError, registerUser } from "@/lib/auth/register";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import {
  buildSessionCookieOptions,
  extractSessionContext,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
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

    return response;
  } catch (error) {
    if (error instanceof RegisterUserError) {
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
