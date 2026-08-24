const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_MODEL = "gemini-3.6-flash";

function apiKey() {
  return Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY") || "";
}

function providerError(status: number, payload: any) {
  const message = String(payload?.error?.message || "");
  const lower = message.toLowerCase();
  if (status === 429 && (lower.includes("quota") || lower.includes("resource_exhausted"))) {
    return "Gemini quota is exhausted for this Google AI Studio project. Enable billing or wait for the quota reset, then retry.";
  }
  if (status === 429) return "Gemini is rate-limiting requests. Please wait a moment and retry.";
  return message || `Gemini request failed (${status})`;
}

function toContents(messages: { role: string; content: string }[] = []) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content || "") }],
    }));
}

export async function geminiGenerate(opts: {
  system?: string;
  prompt?: string;
  messages?: { role: string; content: string }[];
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  const key = apiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const messages = opts.messages?.length ? opts.messages : [{ role: "user", content: opts.prompt || "" }];
  const contents = toContents(messages);
  const systemText = opts.system || opts.messages?.find((message) => message.role === "system")?.content || "";
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.35,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };

  const response = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(providerError(response.status, data));
  return data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
}
