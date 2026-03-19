const protectedRoutePrefixes = ["/workspace"];
const authRoutePrefixes = ["/sign-in", "/sign-up"];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isAuthRoute(pathname: string) {
  return authRoutePrefixes.some((prefix) => matchesPrefix(pathname, prefix));
}
