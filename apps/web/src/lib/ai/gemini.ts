const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    null
  );
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

// Calls Gemini in JSON mode and returns the parsed (still untyped) payload;
// callers validate it with their own Zod schema.
export async function generateGeminiJson(options: {
  apiKey: string;
  prompt: string;
  systemPrompt?: string;
  responseJsonSchema: Record<string, unknown>;
}) {
  const model = getGeminiModel();
  const response = await fetch(`${GEMINI_API_BASE_URL}/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": options.apiKey,
    },
    body: JSON.stringify({
      ...(options.systemPrompt
        ? { systemInstruction: { parts: [{ text: options.systemPrompt }] } }
        : {}),
      contents: [
        {
          role: "user",
          parts: [{ text: options.prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: options.responseJsonSchema,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty payload");
  }

  return {
    model,
    data: JSON.parse(text) as unknown,
  };
}
