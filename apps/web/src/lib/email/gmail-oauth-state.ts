import { randomBytes } from "node:crypto";

import { z } from "zod";

import type { GmailScopeSet } from "@/lib/email/google";
import { resolveSafeRedirectPath } from "@/lib/http/safe-redirect";
import { signValue, verifySignedValue } from "@/lib/security/secrets";

const gmailOauthStatePayloadSchema = z.object({
  nonce: z.string().trim().min(16),
  userId: z.string().trim().min(1),
  scopeSet: z.enum(["mailbox", "mailbox_send"]),
  redirectTo: z.string().trim().min(1),
  redirectUri: z.string().trim().url(),
});

export type GmailOauthStatePayload = z.infer<typeof gmailOauthStatePayloadSchema>;

export function createGmailOauthStatePayload(input: {
  userId: string;
  scopeSet: GmailScopeSet;
  redirectTo: string;
  redirectUri: string;
}): GmailOauthStatePayload {
  return gmailOauthStatePayloadSchema.parse({
    nonce: randomBytes(16).toString("hex"),
    userId: input.userId,
    scopeSet: input.scopeSet,
    redirectTo: resolveSafeRedirectPath(input.redirectTo, "/workspace/email"),
    redirectUri: input.redirectUri,
  });
}

export function encodeGmailOauthStatePayload(payload: GmailOauthStatePayload) {
  return signValue(
    Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
    "oauth-state",
  );
}

export function decodeGmailOauthStatePayload(value: string | null | undefined) {
  const encodedPayload = verifySignedValue(value, "oauth-state");

  if (!encodedPayload) {
    return null;
  }

  try {
    return gmailOauthStatePayloadSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}
