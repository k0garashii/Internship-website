import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { isAuthRoute, isProtectedRoute } from "@/lib/auth/route-protection";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (isProtectedRoute(pathname) && !hasSessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);

    signInUrl.searchParams.set("redirectTo", `${pathname}${search}`);

    return NextResponse.redirect(signInUrl);
  }

  if (isAuthRoute(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/workspace/:path*", "/sign-in", "/sign-up"],
};
