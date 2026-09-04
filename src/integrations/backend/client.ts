import { apiBaseUrl, functionUrl, restUrl } from "@/lib/backendMode";
import { normalizeJsonRequestBody } from "@/lib/typography";
import { requestProtectedAction } from "@/lib/protectedActions";
import { consumeEarlyResponse } from "@/lib/earlyResponse";

export type BackendUser = {
  id: string;
  aud?: string;
  role?: string;
  email?: string;
  phone?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type BackendSession = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number;
  user: BackendUser;
};

export type User = BackendUser;
export type Session = BackendSession;

type ClientError = Error & { code?: string; details?: string; hint?: string; status?: number };
type ClientResult<T = unknown> = {
  data: T | null;
  error: ClientError | null;
  count: number | null;
  status: number;
  statusText: string;
};

const SESSION_KEY = "dc-auth-session";
const resolvedApiUrl = apiBaseUrl();
const mediaBaseUrl = String(import.meta.env.VITE_MEDIA_BASE_URL || "/storage/v1/object/public").replace(/\/$/, "");
const authListeners = new Set<(event: string, session: BackendSession | null) => void>();
let memorySession: BackendSession | null | undefined;
let refreshPromise: Promise<BackendSession | null> | null = null;

function storageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isSession(value: unknown): value is BackendSession {
  const row = value as Partial<BackendSession> | null;
  return Boolean(row?.access_token && row?.refresh_token && row?.user?.id);
}

function readStoredSession() {
  if (memorySession !== undefined) return memorySession;
  memorySession = null;
  if (!storageAvailable()) return memorySession;
  try {
    const current = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (isSession(current)) return (memorySession = current);

    // Preserve existing six-month sessions during the one-time SDK removal.
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const legacy = JSON.parse(localStorage.getItem(key) || "null");
      const candidate = legacy?.currentSession || legacy;
      if (!isSession(candidate)) continue;
      localStorage.setItem(SESSION_KEY, JSON.stringify(candidate));
      localStorage.removeItem(key);
      return (memorySession = candidate);
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  return memorySession;
}

function saveSession(session: BackendSession | null) {
  memorySession = session;
  if (!storageAvailable()) return;
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

function notifyAuth(event: string, session: BackendSession | null) {
  authListeners.forEach((listener) => {
    try { listener(event, session); } catch { /* listener isolation */ }
  });
}

function makeError(payload: any, response?: Response): ClientError {
  const message = payload?.message || payload?.error_description || payload?.msg || payload?.error || response?.statusText || "Request failed";
  const error = new Error(String(message)) as ClientError;
  error.code = payload?.code;
  error.details = payload?.details;
  error.hint = payload?.hint;
  error.status = response?.status;
  return error;
}

async function parseResponse(response: Response) {
  if (response.status === 204 || response.headers.get("content-length") === "0") return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function refreshSession(session: BackendSession) {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${resolvedApiUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      const payload = await parseResponse(response);
      if (response.status === 401) {
        saveSession(null);
        notifyAuth("SIGNED_OUT", null);
        return null;
      }
      if (!response.ok || !isSession(payload)) return session;
      saveSession(payload);
      notifyAuth("TOKEN_REFRESHED", payload);
      return payload;
    } catch {
      // Keep persistent login state during temporary network or origin outages.
      return session;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function activeSession() {
  const session = readStoredSession();
  if (!session) return null;
  if (!session.expires_at || session.expires_at > Math.floor(Date.now() / 1000) + 30) return session;
  return refreshSession(session);
}

async function authorizedHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  const session = await activeSession();
  if (session?.access_token) headers.set("authorization", `Bearer ${session.access_token}`);
  return headers;
}

function literal(value: unknown) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (Array.isArray(value) || (value && typeof value === "object")) return JSON.stringify(value);
  return String(value);
}

function listLiteral(value: unknown) {
  const text = literal(value);
  return typeof value === "string" && /[,()\s]/.test(text) ? JSON.stringify(text) : text;
}

class BackendQuery implements PromiseLike<ClientResult<any>> {
  private operation: "read" | "insert" | "upsert" | "update" | "delete" = "read";
  private columns = "*";
  private body: unknown;
  private filters: Array<[string, string]> = [];
  private orders: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private countMode?: string;
  private headOnly = false;
  private returnRepresentation = false;
  private resultMode: "many" | "single" | "maybeSingle" = "many";
  private signal?: AbortSignal;
  private conflictColumns?: string;
  private shouldThrow = false;

  constructor(private readonly table: string) {}

  select(columns = "*", options: { count?: string; head?: boolean } = {}) {
    this.columns = columns || "*";
    this.countMode = options.count;
    this.headOnly = Boolean(options.head);
    if (this.operation !== "read") this.returnRepresentation = true;
    return this;
  }

  insert(values: unknown) { this.operation = "insert"; this.body = values; return this; }
  upsert(values: unknown, options: { onConflict?: string } = {}) { this.operation = "upsert"; this.body = values; this.conflictColumns = options.onConflict; return this; }
  update(values: unknown) { this.operation = "update"; this.body = values; return this; }
  delete() { this.operation = "delete"; return this; }

  private addFilter(column: string, expression: string) { this.filters.push([column, expression]); return this; }
  eq(column: string, value: unknown) { return this.addFilter(column, `eq.${literal(value)}`); }
  neq(column: string, value: unknown) { return this.addFilter(column, `neq.${literal(value)}`); }
  gt(column: string, value: unknown) { return this.addFilter(column, `gt.${literal(value)}`); }
  gte(column: string, value: unknown) { return this.addFilter(column, `gte.${literal(value)}`); }
  lt(column: string, value: unknown) { return this.addFilter(column, `lt.${literal(value)}`); }
  lte(column: string, value: unknown) { return this.addFilter(column, `lte.${literal(value)}`); }
  like(column: string, value: string) { return this.addFilter(column, `like.${value}`); }
  ilike(column: string, value: string) { return this.addFilter(column, `ilike.${value}`); }
  is(column: string, value: unknown) { return this.addFilter(column, `is.${literal(value)}`); }
  in(column: string, values: unknown[]) { return this.addFilter(column, `in.(${values.map(listLiteral).join(",")})`); }
  contains(column: string, value: unknown) { return this.addFilter(column, `cs.${JSON.stringify(value)}`); }
  containedBy(column: string, value: unknown) { return this.addFilter(column, `cd.${JSON.stringify(value)}`); }
  overlaps(column: string, value: unknown) { return this.addFilter(column, `ov.${JSON.stringify(value)}`); }
  not(column: string, operator: string, value: unknown) { return this.addFilter(column, `not.${operator}.${literal(value)}`); }
  or(expression: string) { return this.addFilter("or", expression); }
  filter(column: string, operator: string, value: unknown) { return this.addFilter(column, `${operator}.${literal(value)}`); }
  match(values: Record<string, unknown>) { Object.entries(values).forEach(([column, value]) => this.eq(column, value)); return this; }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push(`${column}.${options.ascending === false ? "desc" : "asc"}`);
    return this;
  }

  limit(value: number) { this.limitValue = value; return this; }
  range(from: number, to: number) { this.offsetValue = from; this.limitValue = Math.max(0, to - from + 1); return this; }
  single() { this.resultMode = "single"; this.limitValue ??= 1; return this; }
  maybeSingle() { this.resultMode = "maybeSingle"; this.limitValue ??= 2; return this; }
  abortSignal(signal: AbortSignal) { this.signal = signal; return this; }
  throwOnError() { this.shouldThrow = true; return this; }

  private async execute(): Promise<ClientResult<any>> {
    if (this.operation === "delete") {
      const allowed = await requestProtectedAction({ kind: "delete", label: `${this.table} records` });
      if (!allowed) {
        const error = makeError({ code: "ACTION_CANCELLED", message: "Deletion was cancelled or requires administrator access" });
        if (this.shouldThrow) throw error;
        return { data: null, error, count: null, status: 0, statusText: "Cancelled" };
      }
    }
    const url = new URL(restUrl(this.table));
    if (this.columns) url.searchParams.set("select", this.columns);
    this.filters.forEach(([column, expression]) => url.searchParams.append(column, expression));
    if (this.orders.length) url.searchParams.set("order", this.orders.join(","));
    if (this.limitValue !== undefined) url.searchParams.set("limit", String(this.limitValue));
    if (this.offsetValue !== undefined) url.searchParams.set("offset", String(this.offsetValue));
    if (this.conflictColumns) url.searchParams.set("on_conflict", this.conflictColumns);

    const method = this.headOnly ? "HEAD" : ({ read: "GET", insert: "POST", upsert: "POST", update: "PATCH", delete: "DELETE" } as const)[this.operation];
    const headers = await authorizedHeaders();
    const preferences: string[] = [];
    if (this.countMode) preferences.push(`count=${this.countMode}`);
    if (this.operation === "upsert") preferences.push("resolution=merge-duplicates");
    if (this.operation !== "read") preferences.push(`return=${this.returnRepresentation ? "representation" : "minimal"}`);
    if (preferences.length) headers.set("prefer", preferences.join(","));
    if (this.body !== undefined) headers.set("content-type", "application/json");

    try {
      const earlyResponse = method === "GET" ? await consumeEarlyResponse(url) : null;
      const response = earlyResponse ?? await fetch(url, {
        method,
        headers,
        signal: this.signal,
        body: this.body === undefined ? undefined : normalizeJsonRequestBody(JSON.stringify(this.body)),
      });
      const payload = await parseResponse(response);
      const contentRange = response.headers.get("content-range") || "";
      const total = Number(contentRange.split("/")[1]);
      const count = Number.isFinite(total) ? total : null;
      if (!response.ok) {
        const error = makeError(payload, response);
        if (this.shouldThrow) throw error;
        return { data: null, error, count, status: response.status, statusText: response.statusText };
      }

      let data = payload;
      if (this.resultMode !== "many") {
        const rows = Array.isArray(payload) ? payload : payload == null ? [] : [payload];
        if (this.resultMode === "single" && rows.length !== 1) {
          const error = makeError({ code: "DC116", message: `JSON object requested, ${rows.length} rows returned` });
          if (this.shouldThrow) throw error;
          return { data: null, error, count, status: 406, statusText: "Not Acceptable" };
        }
        if (this.resultMode === "maybeSingle" && rows.length > 1) {
          const error = makeError({ code: "DC116", message: `At most one row expected, ${rows.length} returned` });
          if (this.shouldThrow) throw error;
          return { data: null, error, count, status: 406, statusText: "Not Acceptable" };
        }
        data = rows[0] ?? null;
      }
      return { data, error: null, count, status: response.status, statusText: response.statusText };
    } catch (cause) {
      const error = cause instanceof Error ? cause as ClientError : makeError({ message: String(cause) });
      if (this.shouldThrow) throw error;
      return { data: null, error, count: null, status: 0, statusText: "Network Error" };
    }
  }

  then<TResult1 = ClientResult<any>, TResult2 = never>(
    onfulfilled?: ((value: ClientResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

async function requestJson(url: string, init: RequestInit = {}): Promise<ClientResult<any>> {
  try {
    const headers = await authorizedHeaders(init.headers);
    if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(url, { ...init, headers, body: normalizeJsonRequestBody(init.body) });
    const payload = await parseResponse(response);
    return response.ok
      ? { data: payload, error: null, count: null, status: response.status, statusText: response.statusText }
      : { data: null, error: makeError(payload, response), count: null, status: response.status, statusText: response.statusText };
  } catch (cause) {
    return { data: null, error: cause instanceof Error ? cause as ClientError : makeError({ message: String(cause) }), count: null, status: 0, statusText: "Network Error" };
  }
}

const auth = {
  async getSession() {
    const session = await activeSession();
    return { data: { session }, error: null };
  },
  async getUser(jwt?: string) {
    const session = jwt ? null : await activeSession();
    const token = jwt || session?.access_token;
    if (!token) return { data: { user: null }, error: null };
    const result = await requestJson(`${resolvedApiUrl}/auth/v1/user`, { headers: { authorization: `Bearer ${token}` } });
    return { data: { user: result.data as BackendUser | null }, error: result.error };
  },
  async setSession(tokens: { access_token: string; refresh_token: string }) {
    const response = await fetch(`${resolvedApiUrl}/auth/v1/user`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const user = await parseResponse(response);
    if (!response.ok || !user?.id) return { data: { session: null, user: null }, error: makeError(user, response) };
    const payload = JSON.parse(atob(tokens.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const session: BackendSession = { ...tokens, token_type: "bearer", expires_at: payload.exp, expires_in: Math.max(0, payload.exp - Math.floor(Date.now() / 1000)), user };
    saveSession(session);
    notifyAuth("SIGNED_IN", session);
    return { data: { session, user }, error: null };
  },
  onAuthStateChange(callback: (event: string, session: BackendSession | null) => void) {
    authListeners.add(callback);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
  },
  async signOut() {
    const session = readStoredSession();
    if (session?.access_token) await fetch(`${resolvedApiUrl}/auth/v1/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }).catch(() => null);
    saveSession(null);
    notifyAuth("SIGNED_OUT", null);
    return { error: null };
  },
  async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }) {
    const settings = await requestJson(`${resolvedApiUrl}/auth/v1/settings`);
    if (settings.error || !settings.data?.external?.[provider]) {
      return { data: null, error: makeError({ code: "OAUTH_NOT_CONFIGURED", message: `${provider} sign-in is not configured on AWS` }) };
    }
    const url = new URL(`${resolvedApiUrl}/auth/v1/authorize`);
    url.searchParams.set("provider", provider);
    url.searchParams.set("redirect_to", options?.redirectTo || (typeof window !== "undefined" ? window.location.origin : resolvedApiUrl));
    if (typeof window !== "undefined") window.location.assign(url.toString());
    return { data: { provider, url: url.toString() }, error: null };
  },
  async verifyOtp() {
    return { data: null, error: makeError({ code: "OTP_EXCHANGE_REQUIRED", message: "Use the native phone OTP exchange endpoint" }) };
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== SESSION_KEY) return;
    memorySession = undefined;
    const session = readStoredSession();
    notifyAuth(session ? "SIGNED_IN" : "SIGNED_OUT", session);
  });
}

const encodePath = (value: string) => value.split("/").map(encodeURIComponent).join("/");
const storage = {
  from(bucket: string) {
    const bucketPath = encodeURIComponent(bucket);
    return {
      async upload(path: string, body: Blob | ArrayBuffer | Uint8Array, options: { upsert?: boolean; contentType?: string; cacheControl?: string } = {}) {
        const headers = await authorizedHeaders({
          "content-type": options.contentType || (body instanceof Blob ? body.type : "") || "application/octet-stream",
          "x-upsert": String(Boolean(options.upsert)),
          ...(options.cacheControl ? { "cache-control": options.cacheControl } : {}),
        });
        return requestJson(`${resolvedApiUrl}/storage/v1/object/${bucketPath}/${encodePath(path)}`, { method: options.upsert ? "PUT" : "POST", headers, body: body as BodyInit });
      },
      async update(path: string, body: Blob | ArrayBuffer | Uint8Array, options: { contentType?: string; cacheControl?: string } = {}) {
        return this.upload(path, body, { ...options, upsert: true });
      },
      async list(prefix = "", options: { limit?: number; offset?: number; sortBy?: { column?: string; order?: string } } = {}) {
        return requestJson(`${resolvedApiUrl}/storage/v1/object/list/${bucketPath}`, { method: "POST", body: JSON.stringify({ prefix, limit: options.limit || 100, offset: options.offset || 0, sortBy: options.sortBy }) });
      },
      async remove(paths: string[]) {
        const allowed = await requestProtectedAction({ kind: "delete", label: `${paths.length} stored ${paths.length === 1 ? "file" : "files"}`, count: paths.length });
        if (!allowed) return { data: null, error: makeError({ code: "ACTION_CANCELLED", message: "Deletion was cancelled or requires administrator access" }) };
        return requestJson(`${resolvedApiUrl}/storage/v1/object/${bucketPath}`, { method: "DELETE", body: JSON.stringify({ prefixes: paths }) });
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: `${mediaBaseUrl}/${bucketPath}/${encodePath(path)}` } };
      },
      async createSignedUrl(path: string, expiresIn: number) {
        return requestJson(`${resolvedApiUrl}/storage/v1/object/sign/${bucketPath}/${encodePath(path)}`, { method: "POST", body: JSON.stringify({ expiresIn }) });
      },
      async download(path: string) {
        const allowed = await requestProtectedAction({ kind: "download", label: path.split("/").pop() || "this file" });
        if (!allowed) return { data: null, error: makeError({ code: "ACTION_CANCELLED", message: "Download was cancelled or requires administrator access" }) };
        const headers = await authorizedHeaders();
        const response = await fetch(`${resolvedApiUrl}/storage/v1/object/authenticated/${bucketPath}/${encodePath(path)}`, { headers });
        return response.ok ? { data: await response.blob(), error: null } : { data: null, error: makeError(await parseResponse(response), response) };
      },
    };
  },
};

export const backendClient: any = {
  from: (table: string) => new BackendQuery(table),
  rpc: (name: string, args: Record<string, unknown> = {}) => requestJson(`${restUrl(`rpc/${encodeURIComponent(name)}`)}`, { method: "POST", body: JSON.stringify(args) }),
  functions: {
    invoke: (name: string, options: { body?: unknown; headers?: HeadersInit; method?: string } = {}) => requestJson(functionUrl(name), {
      method: options.method || "POST",
      headers: options.headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  },
  auth,
  storage,
};
