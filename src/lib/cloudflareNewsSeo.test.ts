import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import worker from "../../public/_worker.js";

const shellHtml = readFileSync("index.html", "utf8");
const env = {
  ASSETS: { fetch: async () => new Response(shellHtml, { headers: { "content-type": "text/html" } }) },
};
const context = { waitUntil: () => undefined };

afterEach(() => vi.restoreAllMocks());

describe("Cloudflare news archive rendering", () => {
  it("serves crawlable links from the live public article feed", async () => {
    const api = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { title: "JEE Main 2027", slug: "jee-main-2027" },
    ]), { headers: { "content-type": "application/json" } }));

    const response = await worker.fetch(new Request("https://dekhocampus.com/news"), env, context);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<a href="/news/jee-main-2027">JEE Main 2027</a>');
    expect(html).not.toContain("Discover Your Ideal Path");
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(api).toHaveBeenCalledOnce();
    const apiUrl = new URL(String(api.mock.calls[0][0]));
    expect(apiUrl.searchParams.get("site_scope")).toBe("eq.dekhocampus");
    expect(apiUrl.searchParams.get("status")).toBe("eq.Published");
    expect(apiUrl.searchParams.get("offset")).toBe("0");
    expect(apiUrl.searchParams.get("language_code")).toBe("eq.en");
  });

  it.each([["", "neq.en"], ["&language=ta", "eq.ta"]])("serves the independent vernacular archive %s with persistent pagination", async (language, filter) => {
    const api = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(
      Array.from({ length: 13 }, (_, i) => ({ title: `தமிழ் செய்தி ${i}`, slug: `translated-${i}` })),
    ), { headers: { "content-type": "application/json" } }));
    const response = await worker.fetch(new Request(`https://dekhocampus.com/news?category=Vernacular${language}&page=2`), env, context);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Vernacular education news");
    expect(html).toContain('content="index, follow');
    expect(html).toContain(`href="/news?category=Vernacular${language.replace("&", "&amp;")}&amp;page=3"`);
    expect(html).toContain('href="/news?category=Vernacular&amp;language=ta"');
    const apiUrl = new URL(String(api.mock.calls[0][0]));
    expect(apiUrl.searchParams.get("language_code")).toBe(filter);
    expect(apiUrl.searchParams.get("offset")).toBe("12");
  });

  it("paginates the initial HTML and returns 404 beyond the end of the archive", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { headers: { "content-type": "application/json" } }));

    const response = await worker.fetch(new Request("https://dekhocampus.com/news?page=3"), env, context);
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(html).toContain('content="noindex, follow, noarchive"');
  });
});
