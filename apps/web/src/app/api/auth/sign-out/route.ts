import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import {
  buildExpiredSessionCookieOptions,
  getSessionTokenFromCookies,
  revokeSessionByToken,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const sessionToken = await getSessionTokenFromCookies();

  await revokeSessionByToken(sessionToken);

  const response = NextResponse.json(
    {
      redirectTo: "/sign-in",
    },
    {
      status: 200,
    },
  );

  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    buildExpiredSessionCookieOptions(),
  );

  return response;
}
