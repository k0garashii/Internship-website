import { ensureGmailConnectionAccess, GmailMailboxError } from "@/lib/email/gmail-connection";
import { GOOGLE_OAUTH_SCOPES, sendGmailMessage } from "@/lib/email/google";

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_REQUEST_TIMEOUT_MS = 15000;

export type NotificationChannel = "resend" | "gmail";

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  return apiKey && from ? { apiKey, from } : null;
}

async function sendWithResend(
  config: { apiKey: string; from: string },
  input: { to: string; subject: string; text: string },
) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(RESEND_REQUEST_TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend request failed with status ${response.status}`);
  }
}

// Uses the app's mail provider when configured; otherwise sends the message
// from the user's own Gmail to themselves, which needs the send permission.
// Returns null when the user has no usable channel.
export async function sendUserNotificationEmail(input: {
  userId: string;
  to: string;
  subject: string;
  text: string;
}): Promise<NotificationChannel | null> {
  const resend = getResendConfig();

  if (resend) {
    await sendWithResend(resend, input);
    return "resend";
  }

  try {
    const { accessToken } = await ensureGmailConnectionAccess({
      userId: input.userId,
      requiredScopes: [...GOOGLE_OAUTH_SCOPES.compose],
    });

    await sendGmailMessage({
      accessToken,
      to: input.to,
      subject: input.subject,
      body: input.text,
    });

    return "gmail";
  } catch (error) {
    if (error instanceof GmailMailboxError) {
      return null;
    }

    throw error;
  }
}
