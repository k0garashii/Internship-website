import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { generateGeminiJson } from "../../src/lib/ai/gemini";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(response: Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response;
  }) as typeof fetch;

  return calls;
}

test("gemini client sends a JSON-mode request and parses the payload", async () => {
  const calls = mockFetch(
    Response.json({
      candidates: [{ content: { parts: [{ text: '{"subject":"Bonjour"}' }] } }],
    }),
  );

  const result = await generateGeminiJson({
    apiKey: "key-123",
    prompt: "user prompt",
    systemPrompt: "system prompt",
    responseJsonSchema: { type: "object" },
  });
  const body = JSON.parse(String(calls[0]?.init.body));

  assert.deepEqual(result.data, { subject: "Bonjour" });
  assert.match(calls[0]?.url ?? "", /:generateContent$/);
  assert.equal((calls[0]?.init.headers as Record<string, string>)["x-goog-api-key"], "key-123");
  assert.ok(calls[0]?.init.signal, "request must carry a timeout signal");
  assert.equal(body.systemInstruction.parts[0].text, "system prompt");
  assert.equal(body.contents[0].parts[0].text, "user prompt");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
});

test("gemini client omits the system instruction when none is given", async () => {
  const calls = mockFetch(
    Response.json({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }),
  );

  await generateGeminiJson({ apiKey: "k", prompt: "p", responseJsonSchema: {} });

  assert.equal("systemInstruction" in JSON.parse(String(calls[0]?.init.body)), false);
});

test("gemini client surfaces HTTP errors and empty payloads", async () => {
  mockFetch(new Response("quota", { status: 429 }));
  await assert.rejects(
    generateGeminiJson({ apiKey: "k", prompt: "p", responseJsonSchema: {} }),
    /status 429/,
  );

  mockFetch(Response.json({ candidates: [] }));
  await assert.rejects(
    generateGeminiJson({ apiKey: "k", prompt: "p", responseJsonSchema: {} }),
    /empty payload/,
  );
});
