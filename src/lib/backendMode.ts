/**
 * Runtime backend selection. The Node/MySQL API preserves the PostgREST and
 * Edge Function call shapes used by the existing React UI.
 */
export type BackendTarget = "node";

export function backendTarget(): BackendTarget {
  return "node";
}

export function isNodeBackendEnabled() {
  return backendTarget() === "node";
}

export function apiBaseUrl() {
  const value = String(import.meta.env.VITE_API_URL || import.meta.env.VITE_AWS_API_URL || "").replace(/\/$/, "");
  if (value) return value;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://127.0.0.1:8787";
}

export function functionUrl(name: string) {
  return `${apiBaseUrl()}/v1/functions/${encodeURIComponent(name)}`;
}

export function restUrl(path: string) {
  const clean = path.replace(/^\//, "");
  return `${apiBaseUrl()}/v1/rest/${clean}`;
}

/** Route legacy-shaped REST traffic through Node/MySQL. */
export function backendFetch(input: RequestInfo | URL, init?: RequestInit) {
  const original = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(original);
  if (url.pathname.startsWith("/rest/v1/")) {
    const rewritten = `${apiBaseUrl()}/v1/rest/${url.pathname.slice("/rest/v1/".length)}${url.search}`;
    if (typeof Request !== "undefined" && input instanceof Request && !init) return fetch(new Request(rewritten, input));
    return fetch(rewritten, init);
  }
  return fetch(input, init);
}

export async function invokeNodeFunction<T = unknown>(name: string, options: { body?: unknown; headers?: HeadersInit; method?: string } = {}) {
  try {
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await fetch(functionUrl(name), {
      method: options.method || "POST",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = await response.json().catch(() => null) as T | null;
    if (!response.ok) return { data: null, error: new Error((data as { error?: string; message?: string } | null)?.error || (data as { message?: string } | null)?.message || `Node API returned ${response.status}`) };
    return { data, error: null };
  } catch (cause) {
    return { data: null, error: cause instanceof Error ? cause : new Error("Node API request failed") };
  }
}
