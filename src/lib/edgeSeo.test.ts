import { describe, expect, it } from "vitest";
import { applyEdgeSeo, edgeSeoFor } from "../../public/edge-seo.js";

describe("Cloudflare edge SEO", () => {
  it("serves self-canonical metadata for an indexable college filter", () => {
    const seo = edgeSeoFor("https://dekhocampus.com/colleges?stream=Management&state=Delhi+NCR");
    expect(seo.indexable).toBe(true);
    expect(seo.canonical).toBe("https://dekhocampus.com/colleges?stream=Management&state=Delhi+NCR");
    expect(seo.title).toContain("Management Colleges in Delhi NCR 2026");
  });

  it("marks arbitrary search and private URLs noindex", () => {
    expect(edgeSeoFor("https://dekhocampus.com/colleges?q=lpu").indexable).toBe(false);
    expect(edgeSeoFor("https://dekhocampus.com/admin/colleges").indexable).toBe(false);
    expect(edgeSeoFor("https://dekhocampus.com/not-a-real-page").indexable).toBe(false);
  });

  it("derives a useful first-response title for canonical detail URLs", () => {
    const seo = edgeSeoFor("https://dekhocampus.com/colleges/lovely-professional-university-lpu-10042");
    expect(seo.indexable).toBe(true);
    expect(seo.canonical).toBe("https://dekhocampus.com/colleges/lovely-professional-university-lpu-10042");
    expect(seo.title).toContain("Lovely Professional University LPU");
  });

  it("replaces homepage defaults in the initial HTML response", () => {
    const html = '<html><head><title>Home</title><meta name="description" content="home"><meta name="robots" content="index"><link rel="canonical" href="https://dekhocampus.com"><meta property="og:url" content="https://dekhocampus.com"></head></html>';
    const output = applyEdgeSeo(html, edgeSeoFor("https://dekhocampus.com/news/admission-update-2026"));
    expect(output).toContain("Admission Update 2026 | Education News | DekhoCampus");
    expect(output).toContain('rel="canonical" href="https://dekhocampus.com/news/admission-update-2026"');
    expect(output).not.toContain("<title>Home</title>");
  });
});
