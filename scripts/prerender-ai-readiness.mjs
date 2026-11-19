import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import auditPaths from "./ai-readiness-audit-paths.json" with { type: "json" };
import { applyEdgeSeo, articleEdgeSeo, edgeSeoFor, entityEdgeSeo } from "../public/edge-seo.js";

if (process.env.CF_PAGES === "1") {
  const shell = readFileSync(resolve("dist/index.html"), "utf8");
  const apiOrigin = process.env.SITEMAP_SEED_FETCH_BASE_URL || "https://aws-origin.dekhocampus.com";
  const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let rendered = 0;

  for (const path of auditPaths) {
    const url = new URL(path, "https://dekhocampus.com");
    const [, section, publicSlug] = path.split("/");
    let metadata = edgeSeoFor(url);
    if (["news", "colleges", "courses", "exams"].includes(section)) {
      const table = section === "news" ? "articles" : section;
      const shortId = section === "news" ? null : publicSlug.match(/-(\d+)$/)?.[1];
      const query = new URLSearchParams({ select: "*", limit: "1" });
      query.set(shortId ? "short_id" : "slug", `eq.${shortId || publicSlug}`);
      if (section === "news") {
        query.set("status", "eq.Published");
        query.set("site_scope", "eq.dekhocampus");
      }
      const response = await fetch(`${apiOrigin}/v1/rest/${table}?${query}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`${table} ${publicSlug}: HTTP ${response.status}`);
      const [row] = await response.json();
      if (!row || (shortId && `${row.slug}-${row.short_id}` !== publicSlug)) throw new Error(`${table} ${publicSlug}: public row missing`);
      metadata = section === "news" ? articleEdgeSeo(row, url) : entityEdgeSeo(row, url, section);
    } else {
      metadata.prerenderHtml = `<main data-dc-edge-prerender style="max-width:900px;margin:32px auto;padding:0 20px;font-family:var(--font-site,sans-serif);line-height:1.6"><h1>${escape(metadata.title.split(" | ")[0])}</h1><p>${escape(metadata.description)}</p><p><a href="/${escape(section)}">Explore ${escape(section.replace(/-/g, " "))}</a></p></main>`;
    }
    const html = applyEdgeSeo(shell, metadata);
    if (!html.includes(`rel="canonical" href="https://dekhocampus.com${path}"`) || !html.includes("data-dc-edge-prerender")) throw new Error(`Invalid static HTML for ${path}`);
    const output = resolve("dist", `.${path}.html`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, html);
    rendered++;
  }
  console.log(`[ai-readiness] rendered ${rendered} audited pages as static HTML`);
}
