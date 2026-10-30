import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { isProtectedRoute } from "@/lib/auth/route-protection";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Browsers always send Origin on cross-site POST/PATCH/DELETE, so rejecting a
// foreign origin blocks CSRF even if a cookie slips through SameSite. Requests
// without Origin (server-to-server webhooks) are left to the route's own auth.
function isCrossSiteMutation(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) {
    return false;
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (isCrossSiteMutation(request)) {
      return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
    }

    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (isProtectedRoute(pathname) && !hasSessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);

    signInUrl.searchParams.set("redirectTo", `${pathname}${search}`);

    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/workspace/:path*", "/api/:path*"],
};
