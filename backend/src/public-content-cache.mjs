import { createHash, randomUUID } from "node:crypto";
import { createClient } from "redis";

const CONTENT_TABLES = new Set(["articles", "colleges", "courses", "exams"]);
const RELATED_TABLES = new Set([...CONTENT_TABLES, "course_fees", "faqs", "article_links", "authors", "article_categories"]);
const IO_TIMEOUT_MS = 200;
const RETRY_DELAY_MS = 15_000;
const MAX_ENTRY_BYTES = 256 * 1024;

function cacheableRequest(table, request, context) {
  if (!CONTENT_TABLES.has(table) || request.method !== "GET" || context.publicAccess !== true) return false;
  if (request.headers.has("authorization") || request.headers.has("cookie")) return false;
  if (/no-cache|no-store/i.test(request.headers.get("cache-control") || "")) return false;
  const params = new URL(request.url).searchParams;
  if (params.get("is_active") !== "eq.true") return false;
  if (table === "articles" && (params.get("status") !== "eq.Published" || !/^eq\.(dekhocampus|sarkari)$/.test(params.get("site_scope") || ""))) return false;
  return true;
}

export function createPublicContentCache({ url = "", prefix = "dc:public:v1", ttlSeconds = 60, clientFactory = createClient } = {}) {
  const ttl = Math.max(1, Math.min(300, Math.trunc(Number(ttlSeconds)) || 60));
  const revisionKey = `${prefix}:revision`;
  let client;
  let connecting;
  let retryAt = 0;
  const pending = new Map();

  function unavailable() {
    if (Date.now() >= retryAt) console.warn("Public Redis cache unavailable; using the database");
    retryAt = Date.now() + RETRY_DELAY_MS;
    if (client?.isOpen) client.destroy();
    client = undefined;
  }

  async function readyClient() {
    if (!url || Date.now() < retryAt) return null;
    if (client?.isReady) return client;
    if (!connecting) {
      connecting = (async () => {
        try {
          client = clientFactory({ url, disableOfflineQueue: true, commandsQueueMaxLength: 100,
            socket: { connectTimeout: IO_TIMEOUT_MS, reconnectStrategy: false }, commandOptions: { timeout: IO_TIMEOUT_MS } });
          client.on("error", () => {}); // Commands handle failure without logging credentials or endpoints.
          let deadline;
          try {
            await Promise.race([client.connect(), new Promise((_, reject) => {
              deadline = setTimeout(() => reject(new Error("Redis connection timed out")), IO_TIMEOUT_MS);
            })]);
          } finally { clearTimeout(deadline); }
          // A reconnect must not revive entries whose invalidation failed during an outage.
          await client.set(revisionKey, randomUUID());
          return client;
        } catch {
          unavailable();
          return null;
        }
      })().finally(() => { connecting = undefined; });
    }
    return connecting;
  }

  async function invalidate(table) {
    if (table && !RELATED_TABLES.has(table)) return;
    const redis = await readyClient();
    if (!redis) return;
    try { await redis.set(revisionKey, randomUUID()); }
    catch { unavailable(); }
  }

  async function read(table, request, context, load) {
    if (!url || !cacheableRequest(table, request, context)) return load();
    const redis = await readyClient();
    if (!redis) return load();
    let key;
    try {
      let revision = await redis.get(revisionKey);
      if (!revision) {
        // Random generations prevent an evicted revision key from exposing older entries.
        await redis.set(revisionKey, randomUUID(), { NX: true });
        revision = await redis.get(revisionKey);
        if (!revision) return load();
      }
      const normalized = new URL(request.url);
      normalized.searchParams.sort();
      const requestShape = [table, normalized.pathname, normalized.search,
        ...["accept", "prefer", "range", "range-unit", "accept-profile"].map((header) => request.headers.get(header) || "")];
      key = `${prefix}:${revision}:${createHash("sha256").update(JSON.stringify(requestShape)).digest("hex")}`;
      const raw = await redis.get(key);
      if (raw && Buffer.byteLength(raw) <= MAX_ENTRY_BYTES) {
        const result = JSON.parse(raw);
        if (result?.status === 200 && result.body && typeof result.body === "object") {
          return { status: 200, body: result.body, headers: publicHeaders(result.headers) };
        }
      }
    } catch {
      unavailable();
      return load();
    }
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 100) return load();
    const loading = (async () => {
      const result = await load();
      if (result.status === 200 && result.body && typeof result.body === "object") {
        const raw = JSON.stringify({ status: 200, body: result.body, headers: publicHeaders(result.headers) });
        if (Buffer.byteLength(raw) <= MAX_ENTRY_BYTES) {
          try { await redis.set(key, raw, { EX: ttl }); }
          catch { unavailable(); }
        }
      }
      return result;
    })();
    pending.set(key, loading);
    try { return await loading; }
    finally { pending.delete(key); }
  }

  function close() {
    retryAt = Infinity;
    if (client?.isOpen) client.destroy();
    client = undefined;
  }

  return { read, invalidate, close };
}

function publicHeaders(headers = {}) {
  return Object.fromEntries(["content-range", "range-unit"].filter((key) => typeof headers[key] === "string").map((key) => [key, headers[key]]));
}

export const publicContentCache = createPublicContentCache({
  url: process.env.REDIS_URL || "",
  prefix: process.env.REDIS_CACHE_PREFIX || "dc:public:v1",
  ttlSeconds: process.env.REDIS_CACHE_TTL_SECONDS || 60,
});
