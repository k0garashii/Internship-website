const INTERNAL_ORIGIN = "http://internal.invalid";

// Only same-origin relative paths are allowed: "//host", "/\host", absolute URLs
// and control characters would let a crafted link send users to another site.
export function resolveSafeRedirectPath(
  value: string | null | undefined,
  fallback: string,
) {
  const candidate = value?.trim();

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);

    if (url.origin !== INTERNAL_ORIGIN) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
