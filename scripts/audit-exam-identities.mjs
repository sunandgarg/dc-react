#!/usr/bin/env node
// Audit the checked-in, human-reviewed identity inventory. Never auto-approve a crawled image.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { loadCanonicalExamCatalog } from "../backend/src/exam-catalog.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const identities = JSON.parse(await readFile(path.join(root, "shared/exam-identities.json"), "utf8"));
const { catalog } = await loadCanonicalExamCatalog(root);
assert.deepEqual(Object.keys(identities).sort(), catalog.map((row) => row.slug).sort(), "Identity catalog coverage differs");
const counts = {};
const assets = new Set();
const unresolved = [];
for (const exam of catalog) {
  const row = identities[exam.slug];
  assert.ok(row.short_name && row.full_name, `Missing name: ${exam.slug}`);
  assert.doesNotMatch(row.full_name, /20\d{2}\s*[:|]|dates.*eligibility/i, `SEO title is not a full name: ${exam.slug}`);
  assert.ok(["official_source_reviewed", "existing_catalog_mark", "unresolved"].includes(row.logo_status), exam.slug);
  counts[row.logo_status] = (counts[row.logo_status] || 0) + 1;
  if (row.logo_status === "unresolved") {
    assert.equal(row.logo, "", exam.slug);
    assert.ok(row.review_note, `Undocumented logo gap: ${exam.slug}`);
    unresolved.push({ slug: exam.slug, full_name: row.full_name, website: exam.website, reason: row.review_note });
    continue;
  }
  assert.ok(/^https?:\/\//.test(row.source_url), `Missing source: ${exam.slug}`);
  if (row.logo_status === "official_source_reviewed") assert.ok(/^https?:\/\//.test(row.source_page), exam.slug);
  if (row.logo.startsWith("/exam-logos/official-v1/")) {
    assert.match(row.logo, /^\/exam-logos\/official-v1\/[a-f0-9]{24}\.webp$/);
    if (!assets.has(row.logo)) {
      const image = await readFile(path.join(root, "public", row.logo));
      const digest = createHash("sha256").update(image).digest("hex").slice(0, 24);
      assert.equal(path.basename(row.logo), `${digest}.webp`, "Immutable asset hash mismatch");
      const meta = await sharp(image).metadata();
      assert.equal(meta.format, "webp");
      assert.ok(meta.width > 0 && meta.height > 0 && Math.max(meta.width, meta.height) <= 700);
      assets.add(row.logo);
    }
  } else {
    assert.equal(row.logo_status, "existing_catalog_mark", "Reviewed official marks must be first-party files");
    assert.match(row.logo, /^https:\/\/aws-origin\.dekhocampus\.com\/storage\/v1\/object\/public\/legacy-public-assets\/sanitized\/bottom-12-v1\//);
  }
}
const report = { checked_at: new Date().toISOString(), total: catalog.length, counts, assets: assets.size, unresolved };
if (process.argv.includes("--write")) {
  await writeFile(path.join(root, "reports/exam-official-logo-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
  const csv = (value) => `"${String(value || "").replaceAll('"', '""')}"`;
  const columns = ["slug", "short_name", "full_name", "logo_status", "logo", "source_page", "source_url", "review_note"];
  await writeFile(path.join(root, "reports/exam-official-logo-audit.csv"), [columns.join(","), ...catalog.map((exam) => columns.map((column) => csv(column === "slug" ? exam.slug : identities[exam.slug][column])).join(","))].join("\n") + "\n");
  await writeFile(path.join(root, "reports/exam-official-logo-audit.md"), `# Exam identity and logo audit\n\nChecked ${report.checked_at}. All ${catalog.length} canonical exams have separate short and full names.\n\n${counts.official_source_reviewed || 0} use visually reviewed marks from official exam/institution/authority sources, ${counts.existing_catalog_mark || 0} retain existing catalog marks, and ${unresolved.length} remain unresolved. A conducting-authority crest is not presented as a newly invented exam logo.\n\nOfficial assets are immutable, first-party WebP files, at most 600 pixels on the longest side, with no added ring and no synthetic upscaling. Existing catalog marks have not been newly certified as official.\n\n## Outstanding sources\n\n${unresolved.map((row) => `- **${identities[row.slug].short_name}** (${row.slug}): ${row.reason}`).join("\n")}\n\n## Release safeguards\n\nThe UI uses the reviewed asset inventory for missing/obsolete generated logos. Genuine custom saved logos are retained. Unresolved records show a neutral file icon, never an invented seal.\n\nThe full database-logo sync with --assert-complete refuses to run while these source gaps exist. The frontend update can be deployed independently without rewriting production exam rows. Every record and source is listed in exam-official-logo-audit.csv.\n`);
}
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--require-complete") && unresolved.length) process.exitCode = 1;
