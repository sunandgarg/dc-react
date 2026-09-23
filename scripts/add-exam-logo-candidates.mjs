import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import https from "node:https";
const work = ".tmp/exam-official-logos";
const additions = JSON.parse(await readFile(process.argv[2], "utf8"));
const cache = JSON.parse(await readFile(`${work}/discovery.json`, "utf8"));
for (const item of additions) {
  try {
    const ca = await readFile(`${work}/ca-${new URL(item.url).hostname}.pem`, "utf8").catch(() => null);
    const response = ca ? null : await fetch(item.url, { signal: AbortSignal.timeout(20000), headers: { "user-agent": "Mozilla/5.0", referer: item.page } });
    if (response && !response.ok) throw new Error(`HTTP ${response.status}`);
    const body = ca ? await new Promise((resolve, reject) => {
      const req = https.get(item.url, { ca, headers: { "user-agent": "Mozilla/5.0", referer: item.page } }, (res) => {
        if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const chunks = []; res.on("data", (chunk) => chunks.push(chunk)); res.on("end", () => resolve(Buffer.concat(chunks)));
      }); req.setTimeout(20000, () => req.destroy(new Error("timeout"))); req.on("error", reject);
    }) : Buffer.from(await response.arrayBuffer());
    if (body.length > 8_000_000) throw new Error("Source exceeds size limit");
    const meta = await sharp(body, { limitInputPixels: 40_000_000 }).metadata();
    const hash = createHash("sha256").update(body).digest("hex");
    await sharp(body, { limitInputPixels: 40_000_000 }).resize(700, 700, { fit: "inside", withoutEnlargement: true }).webp({ quality: 95 }).toFile(`${work}/${hash}.webp`);
    cache[item.page] ||= { checked_at: new Date().toISOString(), candidates: [], errors: [] };
    cache[item.page].candidates.unshift({ url: item.url, final_url: response?.url || item.url, page: item.page, alt: item.label, width: meta.width, height: meta.height, hash, score: 100 });
    console.log(JSON.stringify({ page: item.page, image: item.url, hash }));
  } catch (error) { console.log(JSON.stringify({ page: item.page, error: error.message })); }
}
await writeFile(`${work}/discovery.json`, JSON.stringify(cache, null, 2));
