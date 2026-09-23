import { describe, expect, it } from "vitest";
import { applyEdgeSeo, applyHomeCriticalCssDelivery, articleEdgeSeo, edgeSeoFor, entityEdgeSeo, newsListingEdgeSeo } from "../../public/edge-seo.js";

describe("Cloudflare edge SEO", () => {
  it("serves self-canonical metadata for an indexable college filter", () => {
    const seo = edgeSeoFor("https://dekhocampus.com/colleges?stream=Management&state=Delhi+NCR");
    expect(seo.indexable).toBe(true);
    expect(seo.canonical).toBe("https://dekhocampus.com/colleges?stream=Management&state=Delhi+NCR");
    expect(seo.title).toContain("Management Colleges in Delhi NCR 2027");
  });

  it("marks arbitrary search and private URLs noindex", () => {
    expect(edgeSeoFor("https://dekhocampus.com/colleges?q=lpu").indexable).toBe(false);
    expect(edgeSeoFor("https://dekhocampus.com/auth/callback").indexable).toBe(false);
    expect(edgeSeoFor("https://dekhocampus.com/admin/colleges").indexable).toBe(false);
    expect(edgeSeoFor("https://dekhocampus.com/not-a-real-page").indexable).toBe(false);
    expect(edgeSeoFor("https://dekhocampus.com/not-a-real-page").notFound).toBe(true);
    expect(edgeSeoFor("https://dekhocampus.com/admin/colleges").notFound).toBe(false);
    expect(edgeSeoFor("https://dekhocampus.com/colleges?q=lpu").notFound).toBe(false);
  });

  it("does not treat public author pages as auth routes", () => {
    const seo = edgeSeoFor("https://dekhocampus.com/author/vartika");
    expect(seo.indexable).toBe(true);
    expect(seo.canonical).toBe("https://dekhocampus.com/author/vartika");
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

  it("makes news archive pages self-canonical and keeps other news queries out of the index", () => {
    expect(edgeSeoFor("https://dekhocampus.com/news?page=2").canonical).toBe("https://dekhocampus.com/news?page=2");
    expect(edgeSeoFor("https://dekhocampus.com/news?page=2").indexable).toBe(true);
    expect(edgeSeoFor("https://dekhocampus.com/news?page=1").indexable).toBe(false);
    expect(edgeSeoFor("https://dekhocampus.com/news?search=jee").indexable).toBe(false);
  });

  it("puts crawlable news links in the first response without the homepage shell", () => {
    const metadata = newsListingEdgeSeo([
      { slug: "jee-main-2027", title: "JEE Main 2027 <Update>" },
    ], new URL("https://dekhocampus.com/news?page=2"), 2, true);
    const html = '<html><head><title>Home</title></head><body><div id="root"><div id="dc-first-paint-shell" hidden><header></header><main><h1>Discover Your Ideal Path</h1></main></div></div></body></html>';
    const output = applyEdgeSeo(html, metadata);
    expect(output).toContain('<a href="/news/jee-main-2027">JEE Main 2027 &lt;Update&gt;</a>');
    expect(output).toContain('<a href="/news">Newer articles</a>');
    expect(output).toContain('<a href="/news?page=3">Older articles</a>');
    expect(output).toContain('rel="canonical" href="https://dekhocampus.com/news?page=2"');
    expect(output).not.toContain("Discover Your Ideal Path");
    expect((output.match(/<h1\b/g) || []).length).toBe(1);
  });

  it("prerenders published article content and NewsArticle schema", () => {
    const url = new URL("https://dekhocampus.com/news/neet-update-2026");
    const metadata = articleEdgeSeo({
      title: "NEET Update 2026",
      description: "The latest verified update.",
      featured_image: "https://cdn.dekhocampus.com/news/neet-update-2026.webp",
      content: '<h2>What changed</h2><p>Useful details.</p><script>alert(1)</script><img src=x onerror="alert(2)"><svg><a href="javascript:alert(3)">bad</a></svg>',
      author: "DekhoCampus Editorial",
      created_at: "2026-09-07T00:00:00.000Z",
    }, url);
    const output = applyEdgeSeo('<html><head><title>Home</title></head><body><div id="root"><div id="dc-first-paint-shell"></div></div></body></html>', metadata);
    expect(output).toContain('"@type":"Organization"');
    expect(output).toContain('"@type":"WebPage"');
    expect(output).toContain('"@type":"BreadcrumbList"');
    expect(output).toContain('"@type":"NewsArticle"');
    expect(output).toContain('"primaryImageOfPage"');
    expect(output).toContain('<img src="https://cdn.dekhocampus.com/news/neet-update-2026.webp"');
    expect(output).toContain('alt="NEET Update 2026"');
    expect(output).toContain("<h2>What changed</h2>");
    expect(output).toContain("What changed");
    expect(output).toContain("Useful details.");
    expect(output).not.toContain("alert(1)");
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("javascript:");
  });

  it("prerenders canonical college images and entity schema for crawlers", () => {
    const metadata = entityEdgeSeo({
      name: "Lovely Professional University",
      page_summary: "Compare LPU courses, fees, admissions and placements for 2027.",
      image: "https://aws-origin.dekhocampus.com/storage/v1/object/public/college-images/lpu.jpg",
      city: "Jalandhar",
      state: "Punjab",
      updated_at: "2026-09-18T00:00:00.000Z",
      youtube_video_url: "https://www.youtube.com/watch?v=abcdefghijk",
    }, new URL("https://dekhocampus.com/colleges/lovely-professional-university-lpu-10042"), "colleges");
    const output = applyEdgeSeo('<html><head><title>Home</title></head><body><div id="root"></div></body></html>', metadata);
    expect(output).toContain('content="https://dekhocampus.com/storage/v1/object/public/college-images/lpu.jpg"');
    expect(output).toContain('alt="Lovely Professional University campus"');
    expect(output).toContain('loading="eager" fetchpriority="high"');
    expect(output).toContain('"@type":"CollegeOrUniversity"');
    expect(output).toContain('"@type":"ImageObject"');
    expect(output).toContain('"primaryImageOfPage"');
    expect(output).toContain('"addressLocality":"Jalandhar"');
    expect(output).toContain('"@type":"VideoObject"');
    expect(output).toContain('"embedUrl":"https://www.youtube.com/embed/abcdefghijk"');
  });

  it("lets the inline homepage shell paint while the full app stylesheet downloads", () => {
    const stylesheet = '<link rel="stylesheet" crossorigin href="/assets/index-AbCd1234.css">';
    const output = applyHomeCriticalCssDelivery(`<html><head>${stylesheet}</head></html>`);
    expect(output).toContain('rel="preload" as="style"');
    expect(output).toContain('data-dc-app-style');
    expect(output).toContain("this.rel='stylesheet'");
    expect(output).toContain(`<noscript>${stylesheet}</noscript>`);
  });

  it("leaves non-Vite stylesheets unchanged", () => {
    const html = '<html><head><link rel="stylesheet" href="/brand.css"></head></html>';
    expect(applyHomeCriticalCssDelivery(html)).toBe(html);
  });
});
