import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const work = ".tmp/exam-official-logos";
const cache = JSON.parse(await readFile(`${work}/discovery.json`, "utf8"));
const unique = new Map();
for (const [page, entry] of Object.entries(cache)) {
  for (const candidate of entry.candidates) {
    if (!unique.has(candidate.hash)) unique.set(candidate.hash, { ...candidate, pages: [] });
    unique.get(candidate.hash).pages.push(page);
  }
}
const previous = await readFile(`${work}/review-index.json`, "utf8").then(JSON.parse).catch(() => []);
const seen = new Set(previous.map((item) => item.hash));
const items = [...previous.map((item) => unique.get(item.hash) || item), ...[...unique.values()].filter((item) => !seen.has(item.hash)).sort((a, b) => a.pages[0].localeCompare(b.pages[0]))];
await writeFile(`${work}/review-index.json`, JSON.stringify(items, null, 2));
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
for (let start = 0; start < items.length; start += 30) {
  const layers = [];
  for (const [offset, item] of items.slice(start, start + 30).entries()) {
    const x = offset % 5 * 240;
    const y = Math.floor(offset / 5) * 185;
    layers.push({ input: await sharp(`${work}/${item.hash}.webp`).flatten({ background: "#fff" }).resize(220, 130, { fit: "contain", background: "#fff" }).png().toBuffer(), left: x + 10, top: y + 5 });
    const host = new URL(item.pages[0]).hostname.replace(/^www\./, "");
    layers.push({ input: Buffer.from(`<svg width="240" height="45"><text x="8" y="17" font-size="13" font-family="Arial">${start + offset}: ${escape(host.slice(0, 28))}</text><text x="8" y="36" font-size="11" font-family="Arial">${escape(item.alt.slice(0, 33))}</text></svg>`), left: x, top: y + 137 });
  }
  await sharp({ create: { width: 1200, height: 1110, channels: 3, background: "#fff" } }).composite(layers).png().toFile(`${work}/sheet-${Math.floor(start / 30)}.png`);
}
console.log(JSON.stringify({ unique_candidates: items.length, sheets: Math.ceil(items.length / 30) }));
