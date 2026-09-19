const SITE_URL = "https://dekhocampus.com";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_KEY = "5ba0c5fbac113b43df29736b4b27dc56";
const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const MAX_BATCH_SIZE = 10_000;
const FLUSH_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;

const pendingUrls = new Set();
let flushTimer;
let flushing = false;

function canonicalIndexNowUrl(value) {
  try {
    const url = new URL(value, SITE_URL);
    if (url.protocol !== "https:" || url.hostname !== "dekhocampus.com") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export async function submitIndexNowUrls(values, options = {}) {
  const urls = [...new Set((values || []).map(canonicalIndexNowUrl).filter(Boolean))].slice(0, MAX_BATCH_SIZE);
  if (!urls.length) return { submitted: 0, skipped: true };

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: "dekhocampus.com",
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(options.timeoutMs || REQUEST_TIMEOUT_MS),
  });

  if (![200, 202].includes(response.status)) {
    const detail = await response.text().catch(() => "");
    throw new Error(`IndexNow rejected the batch (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  return { submitted: urls.length, status: response.status };
}

async function flushIndexNowQueue() {
  if (flushing || !pendingUrls.size) return;
  flushing = true;
  const batch = [...pendingUrls].slice(0, MAX_BATCH_SIZE);
  batch.forEach((url) => pendingUrls.delete(url));
  try {
    await submitIndexNowUrls(batch);
  } catch (error) {
    console.warn(`[indexnow] ${error instanceof Error ? error.message : String(error)}`);
    batch.forEach((url) => pendingUrls.add(url));
  } finally {
    flushing = false;
    if (pendingUrls.size) scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushIndexNowQueue();
  }, FLUSH_DELAY_MS);
  flushTimer.unref?.();
}

export function queueIndexNowUrls(values) {
  for (const value of values || []) {
    const url = canonicalIndexNowUrl(value);
    if (url) pendingUrls.add(url);
  }
  if (pendingUrls.size) scheduleFlush();
  return pendingUrls.size;
}

export const indexNowConfig = Object.freeze({
  endpoint: INDEXNOW_ENDPOINT,
  key: INDEXNOW_KEY,
  keyLocation: INDEXNOW_KEY_LOCATION,
});
