import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import auditPaths from "./ai-readiness-audit-paths.json" with { type: "json" };
import applyUniversities from "../src/data/applyUniversities.json" with { type: "json" };
import delhiNcrUniversities from "../src/data/delhiNcrUniversities.json" with { type: "json" };
import { applyEdgeSeo, articleEdgeSeo, edgeSeoFor, entityEdgeSeo, newsListingEdgeSeo } from "../public/edge-seo.js";

if (process.env.CF_PAGES === "1") {
  const shell = readFileSync(resolve("dist/index.html"), "utf8");
  const apiOrigin = process.env.SITEMAP_SEED_FETCH_BASE_URL || "https://aws-origin.dekhocampus.com";
  const seedUrl = process.env.SITEMAP_SEED_URL === "none" ? "" : process.env.SITEMAP_SEED_URL || "https://dekhocampus.com/sitemap.xml";
  const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const request = async (url, accept = "application/json") => {
    const response = await fetch(url, { headers: { accept }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return accept === "application/json" ? response.json() : response.text();
  };
  const xmlPaths = (xml) => [...xml.matchAll(/<loc>https:\/\/dekhocampus\.com(\/[^<]*)<\/loc>/g)].map((match) => match[1]);
  const examTabs = new Set(["sample-paper", "answer-key", "dates", "application", "eligibility", "syllabus", "results"]);
  const isCoreExamPath = (path) => {
    const match = path.match(/^\/exams\/[^/?#]+(?:\/([^/?#]+))?$/);
    return Boolean(match && (!match[1] || examTabs.has(match[1])));
  };
  const paths = new Set(auditPaths);
  if (seedUrl) {
    const index = await request(new URL(new URL(seedUrl).pathname, apiOrigin), "text/xml");
    const children = [...index.matchAll(/<loc>(https:\/\/dekhocampus\.com\/[^<]+\.xml)<\/loc>/g)].map((match) => match[1]);
    if (!children.length) throw new Error("Published sitemap has no child files");
    for (const child of children) {
      const xml = await request(new URL(new URL(child).pathname, apiOrigin), "text/xml");
      // shortcut: Pages Free cannot hold 250k generated variants; move dynamic
      // pages to on-demand HTML when the site needs every route crawlable.
      for (const path of xmlPaths(xml)) if ((path === "/news" || /^\/news\/[^/]+$/.test(path) || isCoreExamPath(path)) && !path.includes("?") && !path.includes("#")) paths.add(path);
    }
  }
  console.log("[ai-readiness] article and audited routes:", paths.size);
  if (seedUrl && [...paths].filter((path) => /^\/news\/[^/]+$/.test(path)).length < 1000) throw new Error("Published sitemap supplied fewer than 1000 articles");
  if (paths.size > 18000) throw new Error(`Static pages exceed the Cloudflare Free file budget: ${paths.size}`);

  const byEntity = new Map();
  for (const path of paths) {
    const [, section, slug] = path.split("/");
    if (!slug || !["news", "colleges", "courses", "exams"].includes(section)) continue;
    const key = section === "news" ? slug : slug.match(/-(\d+)$/)?.[1];
    if (!key) continue;
    const group = byEntity.get(section) || new Map();
    group.set(key, [...(group.get(key) || []), path]);
    byEntity.set(section, group);
  }

  const render = (path, metadata) => {
    const html = applyEdgeSeo(shell, metadata);
    if (!html.includes('data-dc-edge-prerender') || !html.includes(`rel="canonical" href="${escape(metadata.canonical)}"`)) throw new Error(`Invalid static HTML for ${path}`);
    const output = resolve("dist", `.${path}.html`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, html);
  };
  const rendered = new Set();
  for (const [section, group] of byEntity) {
    const table = section === "news" ? "articles" : section;
    const keys = [...group.keys()];
    for (let index = 0; index < keys.length; index += 25) {
      const batch = keys.slice(index, index + 25);
      const query = new URLSearchParams({ select: "*", limit: String(batch.length) });
      query.set(section === "news" ? "slug" : "short_id", `in.(${batch.join(",")})`);
      query.set("is_active", "eq.true");
      if (section === "news") {
        query.set("status", "eq.Published");
        query.set("site_scope", "eq.dekhocampus");
      }
      const rows = await request(`${apiOrigin}/v1/rest/${table}?${query}`);
      const found = new Map(rows.map((row) => [String(section === "news" ? row.slug : row.short_id), row]));
      for (const key of batch) {
        const row = found.get(key);
        if (!row) throw new Error(`${table} ${key}: sitemap row missing`);
        for (const path of group.get(key)) {
          const url = new URL(path, "https://dekhocampus.com");
          const metadata = section === "news" ? articleEdgeSeo(row, url) : entityEdgeSeo(row, url, section);
          if (section === "news") metadata.initialData = { table: "articles", routeSlug: key, row };
          render(path, metadata);
          rendered.add(path);
        }
      }
    }
    console.log(`[ai-readiness] rendered ${section}: ${[...rendered].filter((path) => path.startsWith(`/${section}/`)).length}`);
  }

  if (paths.has("/news")) {
    const query = new URLSearchParams({ select: "id,slug,title,description,featured_image,category,tags,created_at,featured_rank,language_code", site_scope: "eq.dekhocampus", status: "eq.Published", is_active: "eq.true", language_code: "eq.en", order: "featured_rank.asc", featured_rank: "not.is.null", limit: "5" });
    const pinned = await request(`${apiOrigin}/v1/rest/articles?${query}`);
    query.delete("featured_rank");
    query.set("order", "created_at.desc,id.asc");
    query.set("limit", "10");
    if (pinned.length) query.set("id", `not.in.(${pinned.map((item) => item.id).join(",")})`);
    const response = await fetch(`${apiOrigin}/v1/rest/articles?${query}`, { headers: { accept: "application/json", prefer: "count=exact" }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`News listing: HTTP ${response.status}`);
    const latest = await response.json();
    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    if (!Number.isFinite(total)) throw new Error("News listing count missing");
    const metadata = newsListingEdgeSeo([...pinned, ...latest], new URL("https://dekhocampus.com/news"), 1, total > 10);
    metadata.initialData = { table: "news-listing", pinned, latest, total };
    render("/news", metadata);
    rendered.add("/news");
  }

  for (const path of paths) {
    if (path === "/" || rendered.has(path)) continue;
    const url = new URL(path, "https://dekhocampus.com");
    const metadata = edgeSeoFor(url);
    const section = path.split("/")[1] || "";
    metadata.prerenderHtml = path === "/apply"
      ? `<main data-dc-edge-prerender style="max-width:900px;margin:32px auto;padding:0 20px;font-family:var(--font-site,sans-serif);line-height:1.6"><h1>Only top universities of India, all in one place for you.</h1><p>Explore handpicked universities on the India map. Orange states have a spotlight pick; every state opens official university links.</p><section><h2>Delhi NCR</h2><p>18 universities across nine cities, with links to their official websites.</p><ul>${delhiNcrUniversities.map((university) => `<li><a href="${escape(university.url)}">${escape(university.name)}</a> · ${escape(university.city)}</li>`).join("")}</ul></section>${Object.entries(applyUniversities).map(([state, universities]) => `<section><h2>${escape(state)}</h2>${universities.length ? `<ul>${universities.map((university) => `<li><a href="${escape(university.url)}">${escape(university.name)}</a> · ${escape(university.city)}</li>`).join("")}</ul>` : `<p>Check the <a href="https://www.ugc.gov.in/universitydetails/">UGC university directory</a> for the latest recognised institutions.</p>`}</section>`).join("")}<p><a href="https://www.ugc.gov.in/universitydetails/">Full UGC university directory</a></p></main>`
      : `<main data-dc-edge-prerender style="max-width:900px;margin:32px auto;padding:0 20px;font-family:var(--font-site,sans-serif);line-height:1.6"><h1>${escape(metadata.title.split(" | ")[0])}</h1><p>${escape(metadata.description)}</p><p><a href="/${escape(section)}">Explore ${escape(section.replace(/-/g, " "))}</a></p></main>`;
    render(path, metadata);
    rendered.add(path);
  }
  const articlePaths = [...rendered].filter((path) => /^\/news\/[^/]+$/.test(path));
  if (articlePaths.length) {
    const archive = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...articlePaths.map((path) => `  <url><loc>https://dekhocampus.com${escape(path)}</loc></url>`), '</urlset>'].join("\n");
    writeFileSync(resolve("dist/sitemap-news-archive.xml"), archive);
    const indexPath = resolve("dist/sitemap.xml");
    const index = readFileSync(indexPath, "utf8");
    if (!index.includes("</sitemapindex>")) throw new Error("Static sitemap index missing");
    writeFileSync(indexPath, index.replace("</sitemapindex>", '  <sitemap><loc>https://dekhocampus.com/sitemap-news-archive.xml</loc></sitemap>\n</sitemapindex>'));
  }
  console.log(`[ai-readiness] rendered ${rendered.size} sitemap and audited pages as static HTML`);
}
