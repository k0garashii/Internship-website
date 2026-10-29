import assert from "node:assert/strict";
import test from "node:test";

import {
  createGmailOauthStatePayload,
  decodeGmailOauthStatePayload,
  encodeGmailOauthStatePayload,
} from "../../src/lib/email/gmail-oauth-state";
import { resolveSafeRedirectPath } from "../../src/lib/http/safe-redirect";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  signValue,
  verifySignedValue,
} from "../../src/lib/security/secrets";

test("safe redirect keeps same-origin relative paths", () => {
  assert.equal(resolveSafeRedirectPath("/workspace", "/"), "/workspace");
  assert.equal(
    resolveSafeRedirectPath("/accept-invitation?token=abc#top", "/"),
    "/accept-invitation?token=abc#top",
  );
});

test("safe redirect rejects external and malformed targets", () => {
  for (const target of [
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "workspace",
    "/\tevil",
    "",
    null,
    undefined,
  ]) {
    assert.equal(resolveSafeRedirectPath(target, "/fallback"), "/fallback", String(target));
  }
});

test("signed values reject tampering and cross-purpose reuse", () => {
  const signed = signValue("payload", "oauth-state");

  assert.equal(verifySignedValue(signed, "oauth-state"), "payload");
  assert.equal(verifySignedValue(`${signed}x`, "oauth-state"), null);
  assert.equal(verifySignedValue(signed.replace("payload", "pay1oad"), "oauth-state"), null);
  assert.equal(verifySignedValue(signed, "token-encryption"), null);
  assert.equal(verifySignedValue("payload", "oauth-state"), null);
});

test("secrets round-trip through encryption and legacy plaintext still reads", () => {
  const encrypted = encryptSecret("ya29.token-value");

  assert.ok(isEncryptedSecret(encrypted));
  assert.notEqual(encrypted, encryptSecret("ya29.token-value"));
  assert.equal(decryptSecret(encrypted), "ya29.token-value");
  assert.equal(encryptSecret(encrypted), encrypted);
  assert.equal(decryptSecret("legacy-plaintext-token"), "legacy-plaintext-token");
  assert.equal(encryptSecret(null), null);

  const tampered = `${encrypted.slice(0, -2)}${encrypted.endsWith("A") ? "B" : "A"}`;
  assert.throws(() => decryptSecret(tampered));
});

test("gmail oauth state cookie cannot be forged", () => {
  const payload = createGmailOauthStatePayload({
    userId: "user_1",
    scopeSet: "mailbox",
    redirectTo: "//evil.example",
    redirectUri: "https://app.example/api/email/google/callback",
  });

  assert.equal(payload.redirectTo, "/workspace/email");

  const encoded = encodeGmailOauthStatePayload(payload);
  assert.deepEqual(decodeGmailOauthStatePayload(encoded), payload);

  const forged = Buffer.from(
    JSON.stringify({ ...payload, userId: "victim" }),
    "utf8",
  ).toString("base64url");

  assert.equal(decodeGmailOauthStatePayload(forged), null);
  assert.equal(
    decodeGmailOauthStatePayload(`${forged}.${encoded.split(".").pop()}`),
    null,
  );
});
