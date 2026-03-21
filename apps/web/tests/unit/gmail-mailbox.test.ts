import assert from "node:assert/strict";
import test from "node:test";

import {
  createGmailOauthStatePayload,
  decodeGmailOauthStatePayload,
  encodeGmailOauthStatePayload,
} from "../../src/lib/email/gmail-oauth-state";
import {
  getScopesForScopeSet,
  hasGoogleScopes,
} from "../../src/lib/email/google";
import { normalizeConversationSubject } from "../../src/lib/email/mailbox-replies";

test("gmail scope sets include mailbox and optionally send scopes", () => {
  const mailboxScopes = getScopesForScopeSet("mailbox");
  const sendScopes = getScopesForScopeSet("mailbox_send");

  assert.ok(
    mailboxScopes.includes("https://www.googleapis.com/auth/gmail.readonly"),
  );
  assert.equal(
    hasGoogleScopes(mailboxScopes.join(" "), [
      "https://www.googleapis.com/auth/gmail.readonly",
    ]),
    true,
  );
  assert.equal(
    hasGoogleScopes(mailboxScopes.join(" "), [
      "https://www.googleapis.com/auth/gmail.send",
    ]),
    false,
  );
  assert.ok(
    sendScopes.includes("https://www.googleapis.com/auth/gmail.send"),
  );
});

test("gmail oauth state survives encode and decode", () => {
  const payload = createGmailOauthStatePayload({
    userId: "user_123",
    scopeSet: "mailbox_send",
    redirectTo: "/workspace/email",
  });

  const encoded = encodeGmailOauthStatePayload(payload);
  const decoded = decodeGmailOauthStatePayload(encoded);

  assert.deepEqual(decoded, payload);
});

test("conversation subject normalization strips reply prefixes", () => {
  assert.equal(
    normalizeConversationSubject("Re: Fwd: Entretien - Physics Programmer"),
    "entretien physics programmer",
  );
});
