#!/usr/bin/env node
// Read-only official-site discovery. Candidates require review before publication.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import sharp from "sharp";
import { loadCanonicalExamCatalog } from "../backend/src/exam-catalog.mjs";

const root = process.cwd();
const work = path.join(root, ".tmp/exam-official-logos");
await mkdir(work, { recursive: true });
const { catalog } = await loadCanonicalExamCatalog(root);
const overridesPath = path.join(root, "reports/exam-official-source-overrides.json");
const overrides = await readFile(overridesPath, "utf8").then(JSON.parse).catch(() => ({}));
const cachePath = path.join(work, "discovery.json");
const cache = await readFile(cachePath, "utf8").then(JSON.parse).catch(() => ({}));
const save = () => writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n");
const headers = { "user-agent": "Mozilla/5.0 (compatible; DekhoCampusLogoAudit/1.0)", accept: "text/html,image/*;q=0.9,*/*;q=0.8" };
const urls = [...new Set(catalog.map((row) => overrides[row.slug]?.page || row.website).filter((url) => /^https?:/.test(url)))];
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
const unresolved = process.argv.includes("--unresolved")
  ? new Set(JSON.parse(await readFile("reports/exam-official-logo-audit.json", "utf8")).unresolved.map((row) => overrides[row.slug]?.page || row.website)) : null;
const queue = urls.filter((url) => (!only || url.includes(only)) && (!unresolved || unresolved.has(url)) && (!cache[url] || process.argv.includes("--retry")));
let finished = 0;

async function request(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > 8_000_000) throw new Error("Source exceeds size limit");
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > 8_000_000) throw new Error("Source exceeds size limit");
  return { body, url: response.url, type: response.headers.get("content-type") || "" };
}

async function discover(url) {
  const errors = [];
  const candidates = [];
  const pages = [...new Set([url, new URL(url).origin + "/"])];
  for (const page of pages) {
    try {
      const response = await request(page);
      if (!response.type.includes("html")) continue;
      const dom = new JSDOM(response.body.toString(), { url: response.url, virtualConsole: new VirtualConsole() });
      const document = dom.window.document;
      for (const [index, img] of [...document.querySelectorAll("img")].entries()) {
        const src = img.getAttribute("data-src") || img.getAttribute("src") || "";
        if (!src || src.startsWith("data:")) continue;
        const label = [src, img.alt, img.className, img.id, img.parentElement?.className].join(" ");
        if (!/logo|crest|emblem|brand|seal/i.test(label) && index > 7) continue;
        if (/facebook|twitter|linkedin|youtube|instagram|whatsapp|nic[_-]logo|s3waaslogo|digital.?india|swachh|g20|gandhi|azadi|playstore|appstore|india.?gov/i.test(label)) continue;
        const absolute = new URL(src, document.baseURI).href;
        if (!/^https?:/.test(absolute)) continue;
        const score = (/logo|crest|emblem/i.test(img.alt) ? 40 : 0)
          + (/logo|crest|emblem/i.test(src) ? 30 : 0)
          + (img.closest("header,nav,[class*=header],[id*=header]") ? 20 : 0)
          + Math.max(0, 15 - index) - (/footer/i.test(label) ? 10 : 0);
        candidates.push({ url: absolute, page: response.url, alt: img.alt, score });
      }
      dom.window.close();
      if (candidates.some((item) => item.score >= 50)) break;
    } catch (error) { errors.push({ page, error: error.message }); }
  }
  const unique = [...new Map(candidates.sort((a, b) => b.score - a.score).map((item) => [item.url, item])).values()].sort((a, b) => b.score - a.score);
  const valid = [];
  for (const candidate of unique.slice(0, 4)) {
    try {
      const response = await request(candidate.url);
      const meta = await sharp(response.body, { limitInputPixels: 40_000_000 }).metadata();
      if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < 36) throw new Error("Logo is too small");
      const hash = createHash("sha256").update(response.body).digest("hex");
      const image = await sharp(response.body, { limitInputPixels: 40_000_000 })
        .resize(700, 700, { fit: "inside", withoutEnlargement: true }).webp({ quality: 95 }).toBuffer();
      await writeFile(path.join(work, `${hash}.webp`), image);
      valid.push({ ...candidate, final_url: response.url, width: meta.width, height: meta.height, hash });
    } catch (error) { errors.push({ image: candidate.url, error: error.message }); }
    if (valid.length >= 2) break;
  }
  return { checked_at: new Date().toISOString(), candidates: valid, errors };
}

await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const url = queue.shift();
    cache[url] = await discover(url);
    finished += 1;
    if (finished % 10 === 0 || !queue.length) {
      await save();
      console.log(JSON.stringify({ processed: finished, remaining: queue.length, pages_with_candidates: Object.values(cache).filter((item) => item.candidates.length).length }));
    }
  }
}));
await save();
console.log(JSON.stringify({ total_pages: urls.length, cached: Object.keys(cache).length, candidates: Object.values(cache).filter((item) => item.candidates.length).length, cache: cachePath }));
