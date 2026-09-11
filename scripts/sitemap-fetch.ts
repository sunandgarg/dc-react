export interface SitemapFetchOptions {
  timeoutMs: number;
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (event: { attempt: number; delayMs: number; error: Error }) => void;
}

export class SitemapFetchError extends Error {
  status?: number;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "SitemapFetchError";
    this.status = options.status;
  }
}

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

async function responseMessage(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (/json/i.test(contentType)) {
    const payload = await response.clone().json().catch(() => null);
    if (typeof payload?.message === "string" && payload.message.trim()) return payload.message.trim();
    if (typeof payload?.error === "string" && payload.error.trim()) return payload.error.trim();
  }
  const text = await response.clone().text().catch(() => "");
  return text.trim().slice(0, 300) || `HTTP ${response.status}`;
}

async function fetchParsedWithRetry<T>(
  input: string | URL,
  init: RequestInit,
  parse: (response: Response) => Promise<T>,
  options: SitemapFetchOptions,
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.maxAttempts));
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs));
  const baseDelayMs = Math.max(0, Math.floor(options.baseDelayMs ?? 250));
  const maxDelayMs = Math.max(baseDelayMs, Math.floor(options.maxDelayMs ?? 2_000));
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || ((delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    let retryAfter = 0;
    let failure: SitemapFetchError;

    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      if (response.ok) return await parse(response);
      retryAfter = retryAfterMs(response);
      failure = new SitemapFetchError(await responseMessage(response), { status: response.status });
      if (!retryableStatus(response.status)) throw failure;
    } catch (cause) {
      if (cause instanceof SitemapFetchError && cause.status && !retryableStatus(cause.status)) throw cause;
      failure = cause instanceof SitemapFetchError
        ? cause
        : new SitemapFetchError(
          timedOut ? `Request timed out after ${timeoutMs} ms` : cause instanceof Error ? cause.message : String(cause),
          { cause },
        );
    } finally {
      clearTimeout(timer);
    }

    if (attempt === attempts) throw failure!;
    const delayMs = Math.max(retryAfter, Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1))));
    options.onRetry?.({ attempt, delayMs, error: failure! });
    await sleep(delayMs);
  }

  throw new SitemapFetchError("Sitemap request failed without an attempt");
}

export function fetchJsonWithRetry<T = unknown>(input: string | URL, init: RequestInit, options: SitemapFetchOptions) {
  return fetchParsedWithRetry(input, init, async (response) => response.json() as Promise<T>, options);
}

export function fetchTextWithRetry(input: string | URL, init: RequestInit, options: SitemapFetchOptions) {
  return fetchParsedWithRetry(input, init, (response) => response.text(), options);
}

/**
 * Limits whole pagination streams, rather than individual pages, so one build
 * can never occupy every connection in the three-connection production API pool.
 * The first failure also rejects queued work instead of continuing to hammer a
 * degraded origin after the sitemap can no longer be complete.
 */
export function createFailFastTaskLimiter(concurrency: number) {
  const limit = Math.max(1, Math.floor(concurrency));
  const queue: Array<{
    task: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  let active = 0;
  let terminalError: unknown;

  const rejectQueue = (error: unknown) => {
    while (queue.length) queue.shift()!.reject(error);
  };

  const drain = () => {
    while (!terminalError && active < limit && queue.length) {
      const item = queue.shift()!;
      active += 1;
      void item.task().then(item.resolve, (error) => {
        terminalError = error;
        item.reject(error);
        rejectQueue(error);
      }).finally(() => {
        active -= 1;
        drain();
      });
    }
  };

  return function limitTask<T>(task: () => Promise<T>): Promise<T> {
    if (terminalError) return Promise.reject(terminalError);
    return new Promise<T>((resolve, reject) => {
      queue.push({
        task,
        resolve: (value) => resolve(value as T),
        reject,
      });
      drain();
    });
  };
}

