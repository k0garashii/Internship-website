import { randomBytes } from "node:crypto";

import { z } from "zod";

import type { GmailScopeSet } from "@/lib/email/google";

const gmailOauthStatePayloadSchema = z.object({
  nonce: z.string().trim().min(16),
  userId: z.string().trim().min(1),
  scopeSet: z.enum(["mailbox", "mailbox_send"]),
  redirectTo: z.string().trim().min(1),
});

export type GmailOauthStatePayload = z.infer<typeof gmailOauthStatePayloadSchema>;

export function createGmailOauthStatePayload(input: {
  userId: string;
  scopeSet: GmailScopeSet;
  redirectTo: string;
}): GmailOauthStatePayload {
  return gmailOauthStatePayloadSchema.parse({
    nonce: randomBytes(16).toString("hex"),
    userId: input.userId,
    scopeSet: input.scopeSet,
    redirectTo: input.redirectTo,
  });
}

export function encodeGmailOauthStatePayload(payload: GmailOauthStatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeGmailOauthStatePayload(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return gmailOauthStatePayloadSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}
