import { describe, expect, it } from "vitest";
import { applyEdgeSeo, applyHomeCriticalCssDelivery, articleEdgeSeo, edgeSeoFor, entityEdgeSeo, newsListingEdgeSeo } from "../../public/edge-seo.js";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { RichText } from "@/components/detail/RichText";
import { prepareArticleContent } from "./articleContentSanitizer";

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

  it.each([
    "/colleges/chandigarh-university-10026/overview",
    "/colleges/chandigarh-university-10026/courses",
    "/courses/btech-computer-science-20015/fees",
    "/courses/btech-computer-science-20015/eligibility",
  ])("canonicalizes a full-page section alias without altering its route: %s", (path) => {
    const url = new URL(`https://dekhocampus.com${path}`);
    const original = url.href;
    const seo = edgeSeoFor(url);
    expect(seo.indexable).toBe(true);
    expect(seo.canonical).toBe(`https://dekhocampus.com${path.split("/").slice(0, 3).join("/")}`);
    expect(url.href).toBe(original);
  });

  it.each(["colleges", "courses"])("uses the resolved numeric base canonical throughout %s section schema", (type) => {
    const canonical = `https://dekhocampus.com/${type}/canonical-name-12345`;
    const url = new URL(`https://dekhocampus.com/${type}/legacy-name/overview`);
    const metadata = entityEdgeSeo({ name: "Entity name", slug: "canonical-name", short_id: 12345 }, url, type);
    expect(metadata.canonical).toBe(canonical);
    expect(metadata.title).toContain("Overview");
    const graph = metadata.structuredData["@graph"];
    expect(graph.find(x => x["@type"] === "WebPage")?.url).toBe(canonical);
    expect(graph.find(x => x["@type"] === (type === "colleges" ? "CollegeOrUniversity" : "Course"))?.url).toBe(canonical);
    const breadcrumbs = graph.find(x => x["@type"] === "BreadcrumbList").itemListElement;
    expect(breadcrumbs).toHaveLength(3);
    expect(breadcrumbs[2].item).toBe(canonical);
    expect(JSON.stringify(metadata.structuredData)).not.toContain("legacy-name");
    expect(url.pathname).toBe(`/${type}/legacy-name/overview`);
  });

  it("keeps real exam section canonicals distinct and handles entities without numeric IDs", () => {
    const examUrl = new URL("https://dekhocampus.com/exams/jee-main-30001/syllabus");
    expect(edgeSeoFor(examUrl).canonical).toBe(examUrl.href);
    const exam = entityEdgeSeo({ name: "JEE Main", slug: "jee-main", short_id: 30001 }, examUrl, "exams");
    expect(exam.canonical).toBe(examUrl.href);
    expect(exam.structuredData["@graph"].find(x => x["@type"] === "BreadcrumbList").itemListElement).toHaveLength(4);
    expect(entityEdgeSeo({ name: "Legacy course", slug: "legacy-course" }, new URL("https://dekhocampus.com/courses/legacy-course/fees"), "courses").canonical)
      .toBe("https://dekhocampus.com/courses/legacy-course");
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

  it("keeps a single H1 and matches the author profile, publication time and verified CBSE links", () => {
    const metadata = articleEdgeSeo({
      title: "CBSE Sample Papers 2027 Released for Class 10, 12: Download SQP",
      content: "<h1>Repeat headline</h1><h2>Click here to Download SQPs</h2><p>Check the official papers.</p>",
      author: "DekhoCampus Editorial",
      resolved_author: { name: "Meenakshi Iyer", slug: "meenakshi-iyer" },
      created_at: "2026-09-23T12:34:00.000Z",
    }, new URL("https://dekhocampus.com/news/cbse-sample-papers-2027"));
    const output = applyEdgeSeo('<html><head><title>Home</title></head><body><div id="root"></div></body></html>', metadata);
    expect((output.match(/<h1\b/g) || []).length).toBe(1);
    expect(output).toContain('href="/author/meenakshi-iyer"');
    expect(output).toContain('datetime="2026-09-23T12:34:00.000Z"');
    expect(output).toContain('href="https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html"');
    expect(output).toContain('href="https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html"');
    expect(output).toContain('"@type":"Person","name":"Meenakshi Iyer","url":"https://dekhocampus.com/author/meenakshi-iyer"');
  });

  it("preserves semantic tables, nested paragraphs, body headings and citations in both initial and React HTML", () => {
    const content = '<h1>Eligibility</h1><p>Read the verified rules.</p><h3>Fees</h3><table><caption>Programme fees</caption><thead><tr><th scope="col">Programme</th><th scope="col">Fee</th></tr></thead><tbody><tr><td>BTech</td><td>₹5,000 &amp; taxes</td></tr><tr><td><p>MTech</p></td><td><p>₹7,000</p></td></tr></tbody></table><h2>Sources</h2><p>According to <a href=\\"https://josaa.nic.in/\\">JoSAA</a>, confirm the latest rules.</p><ul><li><a href="/exams/jee-main">JEE Main</a></li></ul>';
    const metadata = articleEdgeSeo({ title: "Admissions guide", content }, new URL("https://dekhocampus.com/news/admissions-guide"));
    const raw = new DOMParser().parseFromString(metadata.prerenderHtml, "text/html");
    const { container } = render(createElement(RichText, { html: prepareArticleContent(content), demoteH1: true }));
    expect(raw.querySelectorAll("h1")).toHaveLength(1);
    expect([...raw.querySelectorAll("h2,h3")].map(x => x.textContent)).toEqual(["Eligibility", "Fees", "Sources"]);
    expect([...raw.querySelectorAll("td,th")].map(x => x.textContent)).toEqual([...container.querySelectorAll("td,th")].map(x => x.textContent));
    expect(raw.querySelector("table caption")?.textContent).toBe("Programme fees");
    expect(raw.querySelector("th")?.getAttribute("scope")).toBe("col");
    expect(raw.querySelector("td p")?.textContent).toBe("MTech");
    expect(raw.querySelector("ul li a")?.textContent).toBe("JEE Main");
    for (const document of [raw, container]) {
      expect(document.querySelector('a[href="https://josaa.nic.in/"]')?.textContent).toBe("JoSAA");
      expect(document.querySelector("table")).not.toBeNull();
    }
    expect(metadata.prerenderHtml).toContain("font-family:var(--font-site,sans-serif)");
  });

  it("does not truncate longer articles or lose direct table-cell text", () => {
    const content = Array.from({ length: 90 }, (_, i) => `<p>Paragraph ${i}</p>`).join("") + '<table><tbody><tr><td>Final crucial value</td></tr></tbody></table>';
    const { prerenderHtml } = articleEdgeSeo({ title: "Complete guide", content }, new URL("https://dekhocampus.com/news/complete-guide"));
    expect(prerenderHtml).toContain("Paragraph 89");
    expect(prerenderHtml).toContain("<td>Final crucial value</td>");
  });

  it("preserves working fragment citations with namespaced edge IDs", () => {
    const content = '<p>Official rule <a href="#source-1">[1]</a>.</p><h2>Sources</h2><ol><li id="source-1"><a href="https://nta.ac.in/">NTA</a></li></ol><p id="location">Not an application ID.</p><p id="bad id">Invalid target</p>';
    const { prerenderHtml } = articleEdgeSeo({ title: "Cited guide", content }, new URL("https://dekhocampus.com/news/cited-guide"));
    const raw = new DOMParser().parseFromString(prerenderHtml, "text/html");
    const { container } = render(createElement(RichText, { html: prepareArticleContent(content) }));
    expect(raw.querySelector('a[href="#dc-article-source-1"]')?.textContent).toBe("[1]");
    expect(raw.querySelector("#dc-article-source-1")?.textContent).toBe("NTA");
    expect(raw.querySelector("#location, [id='bad id']")).toBeNull();
    expect(container.querySelector('a[href="#source-1"]')).toHaveTextContent("[1]");
    expect(container.querySelector("#source-1")).toHaveTextContent("NTA");
  });

  it("preserves row-group spanning semantics without allowing other zero or unsafe dimensions", () => {
    const content = '<table><tbody><tr><th rowspan="0" colspan="0" width="javascript:alert(1)" scope="rowgroup">Physics</th><td>Mechanics</td></tr><tr><td>Optics</td></tr></tbody></table>';
    const { prerenderHtml } = articleEdgeSeo({ title: "Subject map", content }, new URL("https://dekhocampus.com/news/subject-map"));
    const raw = new DOMParser().parseFromString(prerenderHtml, "text/html");
    expect(raw.querySelector("th")?.getAttribute("rowspan")).toBe("0");
    expect(raw.querySelector("th")?.getAttribute("scope")).toBe("rowgroup");
    expect(raw.querySelector("th")?.getAttribute("colspan")).toBeNull();
    expect(raw.querySelector("th")?.getAttribute("width")).toBeNull();
  });

  it("decodes legacy encoded tables before the strict sanitization pass", () => {
    const original = '<h1>Subject weights</h1><table><tr><td>Physics</td><td>35%</td></tr></table><h2>Sources</h2><a href="https://nta.ac.in/">NTA</a><a href="javascript:alert(1)" onclick="alert(2)">Unsafe</a><script>alert(3)</script>';
    const encode = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const content = encode(encode(original));
    const { prerenderHtml } = articleEdgeSeo({ title: "Subject weights", content }, new URL("https://dekhocampus.com/news/subject-weights"));
    const raw = new DOMParser().parseFromString(prerenderHtml, "text/html");
    const { container } = render(createElement(RichText, { html: prepareArticleContent(content) }));
    expect([...raw.querySelectorAll("td")].map(x => x.textContent)).toEqual(["Physics", "35%"]);
    expect(raw.querySelector("h2")?.textContent).toBe("Subject weights");
    expect(raw.querySelectorAll("h1")).toHaveLength(1);
    expect([...raw.querySelectorAll("td")].map(x => x.textContent)).toEqual([...container.querySelectorAll("td")].map(x => x.textContent));
    for (const doc of [raw, container]) {
      expect(doc.querySelector('a[href="https://nta.ac.in/"]')?.textContent).toBe("NTA");
      expect(doc.querySelector('a[href^="javascript:"], [onclick], script')).toBeNull();
    }
  });

  it.each([
    "javascript:alert(1)", "jav&#x61;script:alert(1)", "java&#10;script:alert(1)",
    "javascript&colon;alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)",
  ])("rejects unsafe edge URLs even when obfuscated: %s", (href) => {
    const content = `<h1 onclick="alert(2)">Useful heading</h1><a href="${href}" onmouseover="alert(3)">Unsafe link</a><table><tbody><tr><td onfocus="alert(4)">Safe cell</td></tr></tbody></table><script>alert(5)</script><svg><a href="https://example.org">SVG content</a></svg>`;
    const { prerenderHtml } = articleEdgeSeo({ title: "Safe guide", content }, new URL("https://dekhocampus.com/news/safe-guide"));
    const document = new DOMParser().parseFromString(prerenderHtml, "text/html");
    expect(document.querySelector("a")?.getAttribute("href")).toBeNull();
    expect(document.querySelector("script,svg,iframe,form,[onclick],[onmouseover],[onfocus]")).toBeNull();
    expect(document.querySelector("td")?.textContent).toBe("Safe cell");
    expect(document.querySelector("h2")?.textContent).toBe("Useful heading");
    expect(prerenderHtml).not.toContain("alert(5)");
  });

  it("regenerates attributes and escapes malformed or foreign HTML instead of trusting it", () => {
    const content = '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>"></math><p style="background:url(javascript:alert(2))" id="location">Readable text &amp; details.</p><a href="https://nta.ac.in/notice?year=2027&amp;type=exam" title="Official &quot;notice&quot;" target="evil" rel="opener">Notice</a>';
    const { prerenderHtml } = articleEdgeSeo({ title: "Safe guide", content }, new URL("https://dekhocampus.com/news/safe-guide"));
    const document = new DOMParser().parseFromString(prerenderHtml, "text/html");
    expect(document.querySelector("math,style,[onerror],#location,[target=evil]")).toBeNull();
    expect(document.querySelector('a[href="https://nta.ac.in/notice?year=2027&type=exam"]')?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(document.body.textContent).toContain("Readable text & details.");
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
