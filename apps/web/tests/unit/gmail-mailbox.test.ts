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
import { classifyProfessionalMailboxMessage } from "../../src/lib/email/mailbox-professional-filter";
import { getRequestBaseUrl } from "../../src/lib/http/request-origin";
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
    redirectUri: "http://localhost:3000/api/email/google/callback",
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

test("request base url prefers browser host headers over listener host", () => {
  const request = new Request("http://0.0.0.0:3000/api/email/google/connect", {
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http",
    },
  });

  assert.equal(getRequestBaseUrl(request), "http://localhost:3000");
});

test("professional mailbox classifier keeps recruiter replies aligned with the profile", () => {
  const result = classifyProfessionalMailboxMessage(
    {
      direction: "INBOUND",
      labelIds: ["INBOX"],
      subject: "Interview - Simulation Engineer",
      snippet: "We would like to schedule an interview regarding your application.",
      fromEmail: "talent@cea.fr",
      fromName: "Talent Acquisition",
      toEmails: ["sashadelinas@gmail.com"],
      ccEmails: [],
      canonicalUrl: "https://careers.cea.fr/jobs/123",
    },
    {
      companyTokens: new Set(["cea"]),
      titleTokens: new Set(["simulation", "engineer"]),
      domainTokens: new Set(["simulation", "nucleaire"]),
      senderDomains: new Set(["cea.fr"]),
    },
  );

  assert.equal(result.processingStatus, "PARSED");
  assert.equal(result.isProfessional, true);
  assert.equal(result.signal, "APPLICATION_UPDATE");
});

test("professional mailbox classifier ignores marketing newsletters", () => {
  const result = classifyProfessionalMailboxMessage(
    {
      direction: "INBOUND",
      labelIds: ["CATEGORY_PROMOTIONS"],
      subject: "Newsletter - 10 tips to boost your productivity",
      snippet: "Unsubscribe and manage preferences to keep receiving our promo content.",
      fromEmail: "news@random-tool.com",
      fromName: "Random Tool",
      toEmails: ["sashadelinas@gmail.com"],
      ccEmails: [],
      canonicalUrl: "https://random-tool.com/newsletter",
    },
    {
      companyTokens: new Set(["cea"]),
      titleTokens: new Set(["simulation", "engineer"]),
      domainTokens: new Set(["simulation", "nucleaire"]),
      senderDomains: new Set(["cea.fr"]),
    },
  );

  assert.equal(result.processingStatus, "IGNORED");
  assert.equal(result.isProfessional, false);
});
