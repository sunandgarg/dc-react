#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { uploadStorageObject } from "../src/storage.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const identities = JSON.parse(await readFile(path.join(root, "shared/exam-identities.json"), "utf8"));
const slugs = ["jee-mains", "jee-advanced", "mht-cet", "bitsat", "comedk", "wbjee", "kcet", "viteee", "ap-eamcet", "ts-eamcet", "nest", "met", "national-eligibility-cum-entrance-test-neet", "gate", "ssc-cgl"];
const assets = new Map();
const cbseAsset = "e87b6e234f2120e27c79719b.webp";
const replaceableLogo = (logo) => !logo || /(?:^|\/)(?:legacy-public-assets|exam-logos-v[123]|exam-logos-official-v1)\//.test(logo) || /\/exam-logos\/official-v1\//.test(logo);

for (const slug of slugs) {
  const identity = identities[slug];
  if (identity?.logo_status !== "official_source_reviewed" || !identity.source_url || !/^\/exam-logos\/official-v1\/[a-f0-9]{24}\.webp$/.test(identity.logo)) throw new Error(`No reviewed official logo for ${slug}`);
  const filename = path.basename(identity.logo);
  if (assets.has(filename)) continue;
  const image = await readFile(path.join(root, "public", identity.logo));
  const meta = await sharp(image).metadata();
  if (meta.format !== "webp" || !meta.width || !meta.height || Math.max(meta.width, meta.height) > 700) throw new Error(`Invalid logo asset for ${slug}`);
  assets.set(filename, image);
}
const cbseImage = await readFile(path.join(root, "public/exam-logos/official-v1", cbseAsset));
if ((await sharp(cbseImage).metadata()).format !== "webp") throw new Error("Invalid CBSE board mark");

if (process.argv.includes("--check")) {
  if (!replaceableLogo("legacy-public-assets/old.webp") || !replaceableLogo("https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/old.webp") || replaceableLogo("https://example.com/custom.webp")) throw new Error("Logo replacement guard failed");
  console.log(JSON.stringify({ checked_exam_slugs: slugs.length, checked_assets: assets.size, cbse_board_mark: cbseAsset }));
  process.exit(0);
}
if (!process.argv.includes("--apply")) throw new Error("Pass --check or --apply");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient();
try {
  const rows = await prisma.exams.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, logo: true } });
  const found = new Set(rows.map((row) => row.slug));
  const missing = slugs.filter((slug) => !found.has(slug));
  if (missing.length) throw new Error(`Exam rows missing: ${missing.join(", ")}`);
  const backup = Buffer.from(JSON.stringify({ saved_at: new Date().toISOString(), rows }));
  const backupResult = await uploadStorageObject("system-backups", `question-exam-logos/${Date.now()}.json`, backup, "application/json", { cacheControl: "private,no-store" });
  const cbseUploaded = await uploadStorageObject("admin-uploads", `exam-logos-official-v1/${cbseAsset}`, cbseImage, "image/webp", { upsert: true });
  const uploaded = new Map();
  let updated = 0;
  let retainedCustom = 0;
  for (const row of rows) {
    // Preserve an editor's custom logo; this job replaces only empty or generated marks.
    if (!replaceableLogo(row.logo)) { retainedCustom++; continue; }
    const filename = path.basename(identities[row.slug].logo);
    if (!uploaded.has(filename)) {
      const result = await uploadStorageObject("admin-uploads", `exam-logos-official-v1/${filename}`, assets.get(filename), "image/webp", { upsert: true });
      uploaded.set(filename, result.publicUrl);
    }
    const logo = uploaded.get(filename);
    if (row.logo !== logo) {
      await prisma.exams.update({ where: { id: row.id }, data: { logo } });
      updated++;
    }
  }
  const live = await prisma.exams.findMany({ where: { slug: { in: slugs } }, select: { slug: true, logo: true } });
  if (live.some((row) => !row.logo)) throw new Error("One or more exam logos remain empty");
  console.log(JSON.stringify({ backup_key: backupResult.key, examined: rows.length, s3_assets: uploaded.size, cbse_board_mark_url: cbseUploaded.publicUrl, database_updated: updated, custom_retained: retainedCustom }));
} finally {
  await prisma.$disconnect();
}
