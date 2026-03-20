type LogLevel = "info" | "warn" | "error";

type LogRequestContext = {
  method?: string;
  pathname?: string;
  requestId?: string | null;
  vercelId?: string | null;
};

function buildRequestContext(request?: Request): LogRequestContext | null {
  if (!request) {
    return null;
  }

  try {
    const url = new URL(request.url);

    return {
      method: request.method,
      pathname: url.pathname,
      requestId: request.headers.get("x-request-id"),
      vercelId: request.headers.get("x-vercel-id"),
    };
  } catch {
    return {
      method: request.method,
      requestId: request.headers.get("x-request-id"),
      vercelId: request.headers.get("x-vercel-id"),
    };
  }
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details = error as Error & {
      code?: string;
      status?: number;
      fieldErrors?: Record<string, string[]>;
      cause?: unknown;
    };

    return {
      name: details.name,
      message: details.message,
      stack: details.stack,
      code: details.code,
      status: details.status,
      fieldErrors: details.fieldErrors,
      cause:
        details.cause instanceof Error
          ? {
              name: details.cause.name,
              message: details.cause.message,
            }
          : details.cause,
    };
  }

  if (typeof error === "object" && error !== null) {
    return {
      raw: error,
    };
  }

  return {
    raw: String(error),
  };
}

function writeLog(level: LogLevel, label: string, payload: Record<string, unknown>) {
  const logger =
    level === "error" ? console.error : level === "warn" ? console.warn : console.info;

  logger(label, payload);
}

export function logRouteError(options: {
  level?: LogLevel;
  route: string;
  request?: Request;
  message: string;
  error?: unknown;
  status?: number;
  metadata?: Record<string, unknown>;
}) {
  writeLog(options.level ?? "error", "[route-error]", {
    route: options.route,
    message: options.message,
    status: options.status,
    request: buildRequestContext(options.request),
    error: options.error === undefined ? null : serializeError(options.error),
    metadata: options.metadata ?? null,
  });
}

export function logRouteEvent(options: {
  route: string;
  request?: Request;
  message: string;
  status?: number;
  metadata?: Record<string, unknown>;
}) {
  writeLog("info", "[route-event]", {
    route: options.route,
    message: options.message,
    status: options.status,
    request: buildRequestContext(options.request),
    metadata: options.metadata ?? null,
  });
}

export function logServiceError(options: {
  level?: LogLevel;
  scope: string;
  message: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
}) {
  writeLog(options.level ?? "error", "[service-error]", {
    scope: options.scope,
    message: options.message,
    error: options.error === undefined ? null : serializeError(options.error),
    metadata: options.metadata ?? null,
  });
}

export function logServiceEvent(options: {
  scope: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  writeLog("info", "[service-event]", {
    scope: options.scope,
    message: options.message,
    metadata: options.metadata ?? null,
  });
}
