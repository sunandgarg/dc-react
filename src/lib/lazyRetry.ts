import { lazy, ComponentType } from "react";
import { trackEvent } from "@/lib/analytics";

declare const __APP_BUILD_ID__: string;

/**
 * lazyRetry - wraps React.lazy with auto-retry, structured logging, and a
 * one-time cache-busted reload to recover from stale chunk errors that occur
 * after a deploy (e.g. "Failed to fetch dynamically imported module").
 *
 * Behaviour:
 *  - On a chunk failure: clears browser caches and requests a fresh SPA shell
 *    with a unique recovery query parameter.
 *  - Recovery is throttled per chunk and build so a broken deploy cannot enter
 *    a reload loop.
 *  - A global `vite:preloadError` listener covers dynamic imports that are not
 *    rendered through React.lazy.
 *  - Emits a `chunk_load_error` analytics event with
 *    `{ chunk, attempt, throttledMs, url, message }` so product analytics can
 *    measure the failure rate per build without interrupting the user.
 *  - Final failures re-throw so the nearest ErrorBoundary can render UI.
 */

const RELOAD_THROTTLE_MS = 30_000;
const RECOVERY_PARAM = "_r";
const INSTALL_MARKER = "__dekhoCampusChunkRecoveryInstalled";
let recoveryInFlight: Promise<never> | null = null;

function cleanupRecoveryUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(RECOVERY_PARAM)) return;
  url.searchParams.delete(RECOVERY_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
}

cleanupRecoveryUrl();

export function isChunkLoadError(err: unknown): boolean {
  return /Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(
    String((err as any)?.message || err),
  );
}

function extractChunkUrl(err: unknown): string | undefined {
  const msg = String((err as any)?.message || err || "");
  const match = msg.match(/https?:\/\/[^\s'")]+\.(?:js|css|mjs)/i);
  return match?.[0];
}

async function clearBrowserCaches() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {/* noop */}
}

function logChunkFailure(name: string, attempt: number, err: unknown, throttledMs: number) {
  const chunkUrl = extractChunkUrl(err);
  const detail = {
    chunk: name,
    attempt,
    throttledMs,
    url: chunkUrl,
    href: typeof window !== "undefined" ? window.location.href : undefined,
    message: String((err as any)?.message || err),
  };
  console.error("[lazyRetry] chunk failure", detail);
  try {
    trackEvent("chunk_load_error", detail);
  } catch {/* noop */}
}

export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name = "chunk",
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      logChunkFailure(name, 1, err, 0);

      if (typeof window === "undefined") throw err;

      const reloadKey = `__lazyRetry_reloaded_${__APP_BUILD_ID__}_${name}`;
      const lastReload = Number(sessionStorage.getItem(reloadKey) || "0");
      const throttledMs = Date.now() - lastReload;

      if (throttledMs > RELOAD_THROTTLE_MS) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        await recoverFromChunkFailure();
      }

      logChunkFailure(name, 2, err, throttledMs);
      throw err;
    }
  });
}

export function buildChunkRecoveryUrl(href: string, token: string): string {
  const url = new URL(href);
  url.searchParams.set(RECOVERY_PARAM, token);
  return url.toString();
}

/**
 * Install Vite's documented dynamic-import failure hook. This protects plain
 * imports as well as React.lazy routes and is idempotent across hot reloads.
 */
export function installChunkRecovery() {
  if (typeof window === "undefined") return;
  const markedWindow = window as Window & Record<string, boolean | undefined>;
  if (markedWindow[INSTALL_MARKER]) return;
  markedWindow[INSTALL_MARKER] = true;

  window.addEventListener("vite:preloadError", (event) => {
    const reloadKey = `__lazyRetry_reloaded_${__APP_BUILD_ID__}_vite-preload`;
    const lastReload = Number(sessionStorage.getItem(reloadKey) || "0");
    if (Date.now() - lastReload <= RELOAD_THROTTLE_MS) return;

    // Vite emits this event specifically when a preloaded dynamic import
    // fails, including browser-specific messages such as Safari's "Load
    // failed" that should not be treated as generic fetch errors elsewhere.
    event.preventDefault();
    sessionStorage.setItem(reloadKey, String(Date.now()));
    void recoverFromChunkFailure();
  });
}

/** Clear Cache Storage and request a fresh HTML shell without touching auth or saved work. */
export function recoverFromChunkFailure(): Promise<never> {
  if (recoveryInFlight) return recoveryInFlight;
  if (typeof window === "undefined") return new Promise<never>(() => undefined);

  recoveryInFlight = (async () => {
    await clearBrowserCaches();
    const token = `${__APP_BUILD_ID__}-${Date.now().toString(36)}`;
    window.location.replace(buildChunkRecoveryUrl(window.location.href, token));
    // Keep rejected lazy imports inside Suspense while navigation takes over.
    await new Promise<never>(() => undefined);
  })();

  return recoveryInFlight;
}
