import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import worker from "../../public/_worker.js";

const shellHtml = readFileSync("index.html", "utf8");
const env = { ASSETS: { fetch: async () => new Response(shellHtml, { headers: { "content-type": "text/html" } }) } };
const context = { waitUntil: () => undefined };
const routes = ["/news/existing-article", "/colleges/existing-college-12345", "/courses/existing-course-12345", "/exams/existing-exam-12345"];
const serve = (path: string) => worker.fetch(new Request(`https://dekhocampus.com${path}`), env, context);
const rowsResponse = (rows: unknown) => new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Cloudflare serving failure classification", () => {
  it("embeds only the anonymous public detail response as inert JSON", async () => {
    const row = { id: "a1", slug: "existing-article", title: "News", content: '<p>Text</p></script><script>alert(1)</script>', is_active: true, status: "Published", site_scope: "dekhocampus" };
    const api = vi.spyOn(globalThis, "fetch").mockImplementation(async () => rowsResponse([row]));
    const response = await serve("/news/existing-article");
    const html = await response.text();
    const json = html.match(/<script id="dc-initial-page-data" type="application\/json">(.*?)<\/script>/)?.[1];
    expect(JSON.parse(json!)).toEqual({ table: "articles", routeSlug: "existing-article", row });
    expect(json).not.toContain("<");
    const query = new URL(String(api.mock.calls[0][0])).searchParams;
    expect(query.get("site_scope")).toBe("eq.dekhocampus");
    expect(query.get("status")).toBe("eq.Published");
    expect(api.mock.calls[0][1]?.headers).toEqual({ accept: "application/json" });
    const options = api.mock.calls[0][1] as RequestInit & { cf: { cacheTtlByStatus: Record<string, number> } };
    expect(options.cf.cacheTtlByStatus["200-299"]).toBe(30);
  });
  it.each(routes)("keeps a successful existing lookup indexable: %s", async (route) => {
    const slug = route.split("/").at(-1)!.replace(/-12345$/, "");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => rowsResponse([{ slug, short_id: 12345, name: "Existing entity", title: "Existing article", description: "Verified page details", content: "<p>Existing article body</p>" }]));
    const response = await serve(route);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(`rel="canonical" href="https://dekhocampus.com${route}"`);
    expect(html).toContain('content="index, follow');
    expect(html).toContain("Verified page details");
  });

  it.each(routes)("only confirms absence after successful empty lookups: %s", async (route) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => rowsResponse([]));
    const response = await serve(route);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('content="noindex, follow, noarchive"');
  });

  it.each(["colleges", "courses", "exams"])("does not reuse an old slug lookup after editing %s", async (table) => {
    const cached = new Map<string, string>();
    let slug = "original-name";
    const api = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (!cached.has(url)) {
        const query = new URL(url).searchParams;
        cached.set(url, JSON.stringify(query.get("slug") === `eq.${slug}`
          ? [{ slug, short_id: 12345, name: "Existing entity", description: "Verified page details" }] : []));
      }
      return new Response(cached.get(url), { headers: { "content-type": "application/json" } });
    });
    expect((await serve(`/${table}/${slug}-12345`)).status).toBe(200);
    slug = "edited-name";
    const response = await serve(`/${table}/${slug}-12345`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(`rel="canonical" href="https://dekhocampus.com/${table}/${slug}-12345"`);
    expect(api).toHaveBeenCalledTimes(2);
    expect(new URL(String(api.mock.calls[1][0])).searchParams.get("short_id")).toBe("eq.12345");
  });

  for (const failure of ["http503", "http404", "network", "invalidJson", "errorObject", "wrappedError", "invalidRows", "missingFields"]) {
    it.each(routes)(`${failure} remains temporary instead of removing %s`, async (route) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        if (failure === "network") throw new TypeError("Connection unavailable");
        if (failure === "http503" || failure === "http404") return new Response("Unavailable", { status: failure === "http503" ? 503 : 404 });
        if (failure === "invalidJson") return new Response("<html>Proxy failure</html>");
        if (failure === "errorObject") return rowsResponse({ error: "Database unavailable" });
        if (failure === "wrappedError") return rowsResponse({ data: [], error: "Database unavailable" });
        return rowsResponse({ data: failure === "missingFields" ? [{}] : [null] });
      });
      const response = await serve(route);
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("retry-after")).toBe("60");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      const html = await response.text();
      expect(html).toContain("temporarily unavailable");
      expect(html).toContain('href="/fonts/site-font.css"');
      expect(html).toContain("font-family:var(--font-site,sans-serif)");
      expect(html).not.toContain("noindex");
      expect(html).not.toContain("Database unavailable");
    });
  }

  it("bounds a stalled lookup and clears the timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const request = serve(routes[0]);
    await vi.advanceTimersByTimeAsync(8_000);
    expect((await request).status).toBe(503);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not turn a failed optional author lookup into a missing article", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => String(input).includes("/authors?")
      ? new Response("Unavailable", { status: 503 })
      : rowsResponse([{ title: "Existing article", slug: "existing-article", author_id: "author-1", author: "Verified historical author", content: "<p>Article body</p>" }]));
    const response = await serve(routes[0]);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Verified historical author");
  });

  it("returns a retryable API failure without caching upstream errors", async () => {
    const api = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Database unavailable", { status: 503 }));
    // jsdom's Request.signal is not compatible with Node's native Request copy constructor.
    const request = { url: "https://dekhocampus.com/health", method: "GET", headers: new Headers() } as Request;
    const response = await worker.fetch(request, env, context);
    expect(api).toHaveBeenCalledOnce();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("does not serve a misleading archive when its feed is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unavailable", { status: 503 }));
    const response = await serve("/news?page=2");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("noindex");
  });

  it.each([404, 503])("keeps HEAD status consistent with GET for HTTP %s", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => status === 404 ? rowsResponse([]) : new Response("Unavailable", { status: 503 }));
    const response = await worker.fetch(new Request(`https://dekhocampus.com${routes[0]}`, { method: "HEAD" }), env, context);
    expect(response.status).toBe(status);
    expect(await response.text()).toBe("");
  });
});

describe("Curated listing discovery", () => {
  const publisher = readFileSync("backend/src/sitemap-publish.mjs", "utf8");
  const curatedBlock = publisher.match(/const CURATED_DISCOVERY_ENTRIES = \[([\s\S]*?)\]\.map/)![1];
  const curatedPaths = [...curatedBlock.matchAll(/"([^\"]+)"/g)].map((match) => match[1]);

  it("covers all 30 known sitemap landing routes", () => expect(curatedPaths).toHaveLength(30));

  it.each(curatedPaths)("prerenders useful links instead of an entity 404: %s", async (route) => {
    const api = vi.spyOn(globalThis, "fetch").mockImplementation(async () => rowsResponse([{ name: "Matching <entry>", slug: "matching-entry", short_id: 12345, category: "Engineering" }]));
    const response = await serve(route);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(`rel="canonical" href="https://dekhocampus.com${route}"`);
    expect(html).toContain('content="index, follow');
    expect(html).toContain(`href="/${route.split("/")[1]}/matching-entry-12345"`);
    expect(html).toContain("Matching &lt;entry&gt;");
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(api).toHaveBeenCalledOnce();
    const query = new URL(String(api.mock.calls[0][0])).searchParams;
    expect(query.has("slug")).toBe(false);
    expect(query.get("limit")).toBe("18");
    expect(query.get("is_active")).toBe("eq.true");
    if (/top-(national|state)-/.test(route)) {
      expect(query.get("level")).toBe(route.includes("national") ? "eq.National" : "eq.State");
      expect(query.has("education_levels")).toBe(false);
    }
  });

  it.each(["top-not-a-curated-route", "constructor", "__proto__"])("keeps unknown slugs as genuine missing pages: %s", async (slug) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => rowsResponse([]));
    expect((await serve(`/colleges/${slug}`)).status).toBe(404);
  });

  it("keeps curated feed outages temporary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unavailable", { status: 503 }));
    const response = await serve(curatedPaths[0]);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("noindex");
  });

  it("blocks exact authentication paths without blocking author profiles", () => {
    for (const path of ["public/robots.txt", "scripts/apply-site-metadata.ts"]) {
      const robots = readFileSync(path, "utf8");
      expect(robots).not.toMatch(/^Disallow: \/auth$/m);
      expect((robots.match(/^Disallow: \/auth\$$/gm) || []).length).toBe(4);
      expect((robots.match(/^Disallow: \/auth\/$/gm) || []).length).toBe(4);
      expect(robots).not.toContain("Disallow: /author");
    }
  });
});
