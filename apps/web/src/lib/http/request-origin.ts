function getFirstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getConfiguredBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();

  if (!configured) {
    return null;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

// Prefer the configured public URL: forwarded headers can be forged by the
// client when the app is not behind a proxy that overwrites them.
export function getRequestBaseUrl(request: Request) {
  const configuredBaseUrl = getConfiguredBaseUrl();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

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
