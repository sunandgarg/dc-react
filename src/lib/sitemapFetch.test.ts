import { describe, expect, it, vi } from "vitest";
import { createFailFastTaskLimiter, fetchJsonWithRetry, SitemapFetchError } from "../../scripts/sitemap-fetch";

describe("production sitemap fetching", () => {
  it("caps complete pagination streams at two concurrent tasks", async () => {
    const limit = createFailFastTaskLimiter(2);
    let active = 0;
    let peak = 0;

    const values = await Promise.all(Array.from({ length: 8 }, (_, index) => limit(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active -= 1;
      return index;
    })));

    expect(values).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBe(2);
  });

  it("retries transient responses and honors Retry-After", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "database busy" }), {
        status: 503,
        headers: { "content-type": "application/json", "retry-after": "1" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "row-1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    const sleep = vi.fn(async () => undefined);

    const result = await fetchJsonWithRetry<Array<{ id: string }>>("https://example.test/rows", {}, {
      timeoutMs: 1_000,
      maxAttempts: 3,
      fetchImpl,
      sleep,
    });

    expect(result).toEqual([{ id: "row-1" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("fails immediately for permanent client errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ message: "bad filter" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));
    const sleep = vi.fn(async () => undefined);

    await expect(fetchJsonWithRetry("https://example.test/rows", {}, {
      timeoutMs: 1_000,
      maxAttempts: 4,
      fetchImpl,
      sleep,
    })).rejects.toMatchObject<SitemapFetchError>({ message: "bad filter", status: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
