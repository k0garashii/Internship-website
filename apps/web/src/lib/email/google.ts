import { z } from "zod";

import { logServiceEvent } from "@/lib/observability/error-logging";

export type GmailScopeSet = "mailbox" | "mailbox_send";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_OAUTH_STATE_COOKIE = "gmail_oauth_state";
export const GOOGLE_OAUTH_SCOPES = {
  identity: ["openid", "email", "profile"],
  mailbox: ["https://www.googleapis.com/auth/gmail.readonly"],
  compose: [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
  ],
} as const;

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

const googleTokenResponseSchema = z.object({
  access_token: z.string().trim().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().trim().min(1).optional(),
  scope: z.string().trim().min(1).optional(),
  token_type: z.string().trim().min(1).optional(),
  id_token: z.string().trim().min(1).optional(),
});

const googleUserInfoSchema = z.object({
  sub: z.string().trim().min(1),
  email: z.string().trim().email(),
  email_verified: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
  picture: z.string().trim().url().optional(),
});

export const gmailProfileSchema = z.object({
  emailAddress: z.string().trim().email(),
  messagesTotal: z.number().int().nonnegative(),
  threadsTotal: z.number().int().nonnegative(),
  historyId: z.string().trim().min(1),
});

export const gmailMessageListSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        threadId: z.string().trim().min(1).optional(),
      }),
    )
    .optional(),
  nextPageToken: z.string().trim().min(1).optional(),
  resultSizeEstimate: z.number().int().nonnegative().optional(),
});

export const gmailHistoryListSchema = z.object({
  history: z
    .array(
      z.object({
        id: z.string().trim().min(1).optional(),
        messagesAdded: z
          .array(
            z.object({
              message: z.object({
                id: z.string().trim().min(1),
                threadId: z.string().trim().min(1).optional(),
              }),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  historyId: z.string().trim().min(1).optional(),
  nextPageToken: z.string().trim().min(1).optional(),
});

export const gmailMessageDetailSchema = z.object({
  id: z.string().trim().min(1),
  threadId: z.string().trim().min(1),
  labelIds: z.array(z.string().trim().min(1)).optional(),
  snippet: z.string().optional(),
  internalDate: z.string().trim().min(1).optional(),
  payload: z
    .object({
      headers: z
        .array(
          z.object({
            name: z.string().trim().min(1),
            value: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type GoogleTokenPayload = z.infer<typeof googleTokenResponseSchema>;
export type GoogleUserInfo = z.infer<typeof googleUserInfoSchema>;
export type GmailProfile = z.infer<typeof gmailProfileSchema>;
export type GmailMessageList = z.infer<typeof gmailMessageListSchema>;
export type GmailHistoryList = z.infer<typeof gmailHistoryListSchema>;
export type GmailMessageDetail = z.infer<typeof gmailMessageDetailSchema>;

export class GoogleIntegrationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleIntegrationError";
  }
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || "http://127.0.0.1:3000";
}

export function getGoogleOauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    new URL("/api/email/google/callback", getAppBaseUrl()).toString();

  return {
    clientId,
    clientSecret,
    redirectUri,
    appBaseUrl: getAppBaseUrl(),
    isConfigured: Boolean(clientId && clientSecret),
  };
}

export function getScopesForScopeSet(scopeSet: GmailScopeSet) {
  const baseScopes = [...GOOGLE_OAUTH_SCOPES.identity, ...GOOGLE_OAUTH_SCOPES.mailbox];

  if (scopeSet === "mailbox_send") {
    return [...baseScopes, ...GOOGLE_OAUTH_SCOPES.compose];
  }

  return baseScopes;
}

export function parseGoogleScope(scope: string | null | undefined) {
  return new Set(
    (scope ?? "")
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function hasGoogleScopes(
  grantedScope: string | null | undefined,
  requiredScopes: Iterable<string>,
) {
  const granted = parseGoogleScope(grantedScope);

  for (const scope of requiredScopes) {
    if (!granted.has(scope)) {
      return false;
    }
  }

  return true;
}

export function buildGoogleAuthUrl(options: {
  scopeSet: GmailScopeSet;
  state: string;
}) {
  const config = getGoogleOauthConfig();

  if (!config.clientId) {
    throw new GoogleIntegrationError("Google OAuth client ID is not configured", 500);
  }

  const url = new URL(GOOGLE_AUTH_BASE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getScopesForScopeSet(options.scopeSet).join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", options.scopeSet === "mailbox_send" ? "consent" : "select_account");
  url.searchParams.set("state", options.state);

  return url.toString();
}

async function parseGoogleError(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: string;
      error_description?: string;
    };

    return payload.error_description || payload.error || `Google request failed with ${response.status}`;
  } catch {
    return `Google request failed with ${response.status}`;
  }
}

export async function exchangeGoogleCodeForTokens(code: string) {
  const config = getGoogleOauthConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new GoogleIntegrationError("Google OAuth credentials are not configured", 500);
  }

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  return googleTokenResponseSchema.parse(await response.json());
}

export async function refreshGoogleTokens(refreshToken: string) {
  const config = getGoogleOauthConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new GoogleIntegrationError("Google OAuth credentials are not configured", 500);
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  const payload = googleTokenResponseSchema.parse(await response.json());
  logServiceEvent({
    scope: "email/google",
    message: "Google access token refreshed",
  });
  return payload;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  return googleUserInfoSchema.parse(await response.json());
}

export async function gmailApiRequest<T>(
  path: string,
  accessToken: string,
  schema: z.ZodSchema<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  return schema.parse(await response.json());
}

export async function getGmailProfile(accessToken: string) {
  return gmailApiRequest("/profile", accessToken, gmailProfileSchema);
}

export async function listGmailMessages(options: {
  accessToken: string;
  query?: string | null;
  pageToken?: string | null;
  maxResults?: number;
}) {
  const url = new URL(`${GMAIL_API_BASE_URL}/messages`);

  if (options.query?.trim()) {
    url.searchParams.set("q", options.query.trim());
  }

  if (options.pageToken) {
    url.searchParams.set("pageToken", options.pageToken);
  }

  url.searchParams.set("maxResults", String(options.maxResults ?? 25));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  return gmailMessageListSchema.parse(await response.json());
}

export async function listGmailHistory(options: {
  accessToken: string;
  startHistoryId: string;
  pageToken?: string | null;
  maxResults?: number;
}) {
  const url = new URL(`${GMAIL_API_BASE_URL}/history`);
  url.searchParams.set("startHistoryId", options.startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("maxResults", String(options.maxResults ?? 100));

  if (options.pageToken) {
    url.searchParams.set("pageToken", options.pageToken);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  return gmailHistoryListSchema.parse(await response.json());
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  const url = new URL(`${GMAIL_API_BASE_URL}/messages/${messageId}`);
  url.searchParams.set("format", "metadata");
  for (const header of [
    "Subject",
    "From",
    "To",
    "Cc",
    "Date",
    "Message-Id",
    "In-Reply-To",
    "References",
  ]) {
    url.searchParams.append("metadataHeaders", header);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  return gmailMessageDetailSchema.parse(await response.json());
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawMimeMessage(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
}) {
  const lines = [
    `To: ${input.to}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    `Subject: ${input.subject}`,
    "",
    input.body,
  ];

  if (input.threadId) {
    lines.splice(1, 0, `X-Thread-Reference: ${input.threadId}`);
  }

  return encodeBase64Url(lines.join("\r\n"));
}

export async function createGmailDraft(options: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
}) {
  const response = await fetch(`${GMAIL_API_BASE_URL}/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: {
        raw: buildRawMimeMessage(options),
        threadId: options.threadId ?? undefined,
      },
    }),
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  return (await response.json()) as {
    id?: string;
    message?: {
      id?: string;
      threadId?: string;
    };
  };
}

export async function sendGmailMessage(options: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
}) {
  const response = await fetch(`${GMAIL_API_BASE_URL}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      raw: buildRawMimeMessage(options),
      threadId: options.threadId ?? undefined,
    }),
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(await parseGoogleError(response), response.status);
  }

  return (await response.json()) as {
    id?: string;
    threadId?: string;
    labelIds?: string[];
  };
}
