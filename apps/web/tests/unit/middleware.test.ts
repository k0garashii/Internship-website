import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { middleware } from "../../src/middleware";

function request(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`https://app.example${path}`, init);
}

test("API mutations from another origin are rejected", () => {
  const crossOrigin = middleware(
    request("/api/profile", { method: "PATCH", headers: { origin: "https://evil.example" } }),
  );
  const crossSite = middleware(
    request("/api/auth/sign-in", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
  );

  assert.equal(crossOrigin.status, 403);
  assert.equal(crossSite.status, 403);
});

test("same-origin mutations, reads and server-to-server calls pass through", () => {
  const sameOrigin = middleware(
    request("/api/profile", { method: "PATCH", headers: { origin: "https://app.example" } }),
  );
  const crossOriginRead = middleware(
    request("/api/health", { headers: { origin: "https://evil.example" } }),
  );
  const webhook = middleware(request("/api/email/forwarding/intake", { method: "POST" }));

  for (const response of [sameOrigin, crossOriginRead, webhook]) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }
});

test("protected pages redirect to sign-in without a session cookie", () => {
  const response = middleware(request("/workspace/search?tab=offers"));

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://app.example/sign-in?redirectTo=%2Fworkspace%2Fsearch%3Ftab%3Doffers",
  );
});
