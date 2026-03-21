function getFirstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function getRequestBaseUrl(request: Request) {
  const fallback = new URL(request.url);
  const forwardedProtocol = getFirstHeaderValue(
    request.headers.get("x-forwarded-proto"),
  );
  const forwardedHost = getFirstHeaderValue(
    request.headers.get("x-forwarded-host"),
  );
  const host = getFirstHeaderValue(request.headers.get("host")) || fallback.host;
  const protocol = forwardedProtocol || fallback.protocol.replace(":", "");

  return `${protocol}://${forwardedHost || host}`;
}

