import { afterEach, expect, test, vi } from "vitest";
import { onRequest } from "../../functions/sitemap-0.xml";

afterEach(() => vi.unstubAllGlobals());

test("public recent sitemap proxies the live AWS XML", async () => {
  const fetchMock = vi.fn(async () => new Response("<urlset><url /></urlset>", { headers: { "content-type": "application/xml" } }));
  vi.stubGlobal("fetch", fetchMock);
  const response = await onRequest({ request: new Request("https://dekhocampus.com/sitemap-0.xml") });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("<urlset>");
  expect(fetchMock).toHaveBeenCalledWith("https://aws-origin.dekhocampus.com/sitemap-0.xml", { method: "GET" });
});

test("live sitemap fails closed when the origin is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 503 })));
  const response = await onRequest({ request: new Request("https://dekhocampus.com/news-sitemap.xml") });
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
