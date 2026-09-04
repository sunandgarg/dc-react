type EarlyResponseRegistry = Map<string, Promise<Response | null>>;

declare global {
  interface Window {
    __dcEarlyResponses?: EarlyResponseRegistry;
  }
}

function registry() {
  if (typeof window === "undefined") return null;
  return (window.__dcEarlyResponses ??= new Map());
}

function requestKey(input: string | URL) {
  const base = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  return new URL(input, base).toString();
}

/** Reuse a public detail request started by the HTML shell before React loaded. */
export async function consumeEarlyResponse(input: string | URL) {
  const responses = registry();
  if (!responses) return null;
  const key = requestKey(input);
  const pending = responses.get(key);
  if (!pending) return null;
  responses.delete(key);
  try {
    const response = await pending;
    return response?.clone() ?? null;
  } catch {
    return null;
  }
}
