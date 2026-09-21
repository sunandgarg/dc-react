#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const repoRoot = process.cwd();
const syncRoot = path.resolve(repoRoot, "../upgrad-sync");
const inputPath = path.join(syncRoot, "programs-before.json");
const outputDir = path.join(syncRoot, "original-program-covers");
const manifestPath = path.join(syncRoot, "original-program-covers-manifest.json");

const palettes = {
  ai: ["#0B172A", "#174EA6", "#52B6FF", "#D9F1FF"],
  data: ["#101A2C", "#26547C", "#58C4B2", "#DAF5EF"],
  management: ["#1D172C", "#5B3B8C", "#E0A458", "#FFF0D0"],
  doctorate: ["#161922", "#3C4356", "#B9935A", "#F3E7CE"],
  education: ["#18211C", "#39735A", "#85C7A4", "#E4F6EC"],
  marketing: ["#251725", "#8B3A62", "#FF8F70", "#FFE6DD"],
  project: ["#121D25", "#27546B", "#F0A259", "#FFF0DB"],
  default: ["#101827", "#3159A8", "#FF7A45", "#FCE8DE"],
};

function xml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function kindFor(program) {
  const haystack = `${program.title} ${program.category_slug} ${program.program_type}`.toLowerCase();
  if (/doctor|dba|phd/.test(haystack)) return "doctorate";
  if (/education|teaching/.test(haystack)) return "education";
  if (/marketing|communication/.test(haystack)) return "marketing";
  if (/project|pmp|prince|capm|pgmp|pfmp/.test(haystack)) return "project";
  if (/data science|analytics/.test(haystack)) return "data";
  if (/artificial|machine learning|\bai\b|agentic|generative/.test(haystack)) return "ai";
  if (/management|business|mba|leadership|finance|insurance/.test(haystack)) return "management";
  return "default";
}

function wrap(text, max = 33, maxLines = 4) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= max || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length && lines.length) lines[lines.length - 1] = `${lines.at(-1).replace(/[.,;:]?$/, "")}…`;
  return lines;
}

function compactLabel(program) {
  const type = String(program.program_type || "Programme").replace("'s", "");
  const mode = program.delivery_mode || "Online";
  return `${mode} · ${type}`;
}

function makeSvg(program, index) {
  const kind = kindFor(program);
  const [ink, base, accent, mist] = palettes[kind] || palettes.default;
  const titleLines = wrap(program.title, 28, 4);
  const titleSvg = titleLines.map((line, i) =>
    `<text x="92" y="${354 + i * 72}" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="54" font-weight="760" letter-spacing="-1.2">${xml(line)}</text>`,
  ).join("\n");
  const code = String(index + 1).padStart(2, "0");
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1100" viewBox="0 0 1200 1100">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${ink}"/>
        <stop offset="0.58" stop-color="${base}"/>
        <stop offset="1" stop-color="${ink}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${accent}" stop-opacity=".64"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="34"/></filter>
      <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
        <path d="M42 0H0V42" fill="none" stroke="#FFFFFF" stroke-opacity=".055"/>
      </pattern>
    </defs>
    <rect width="1200" height="1100" rx="42" fill="url(#bg)"/>
    <rect width="1200" height="1100" rx="42" fill="url(#grid)"/>
    <circle cx="1040" cy="190" r="270" fill="url(#glow)" filter="url(#blur)"/>
    <circle cx="1050" cy="890" r="320" fill="url(#glow)" opacity=".7" filter="url(#blur)"/>
    <path d="M810 80C1000 170 1135 355 1160 570C1175 750 1100 920 970 1060" fill="none" stroke="${mist}" stroke-opacity=".33" stroke-width="2"/>
    <path d="M870 80C1030 190 1120 360 1130 540C1140 730 1055 875 930 1020" fill="none" stroke="#FFFFFF" stroke-opacity=".22" stroke-width="2"/>
    <g transform="translate(842 232)">
      <rect width="270" height="270" rx="66" fill="#FFFFFF" fill-opacity=".11" stroke="#FFFFFF" stroke-opacity=".24"/>
      <path d="M62 165L135 82L208 165" fill="none" stroke="${mist}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M83 165V205M187 165V205M55 205H215" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>
      <circle cx="135" cy="70" r="15" fill="${accent}"/>
    </g>
    <rect x="92" y="96" width="250" height="46" rx="23" fill="#FFFFFF" fill-opacity=".12" stroke="#FFFFFF" stroke-opacity=".22"/>
    <text x="217" y="127" text-anchor="middle" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="1.5">${xml(compactLabel(program).toUpperCase())}</text>
    <text x="92" y="258" fill="${mist}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="650" letter-spacing=".2">${xml(program.college_name)}</text>
    ${titleSvg}
    <g transform="translate(92 898)">
      <rect width="590" height="2" rx="1" fill="#FFFFFF" fill-opacity=".22"/>
      <text y="62" fill="#FFFFFF" fill-opacity=".82" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600">Explore with clarity on DekhoCampus</text>
    </g>
    <g transform="translate(986 866)">
      <circle cx="62" cy="62" r="62" fill="#FFFFFF" fill-opacity=".12" stroke="#FFFFFF" stroke-opacity=".22"/>
      <text x="62" y="75" text-anchor="middle" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800">${code}</text>
    </g>
  </svg>`;
}

await fs.mkdir(outputDir, { recursive: true });
const programs = JSON.parse(await fs.readFile(inputPath, "utf8"));
const manifest = [];

for (const [index, program] of programs.entries()) {
  const filename = `${program.slug}-dekhocampus-cover.webp`;
  const outputPath = path.join(outputDir, filename);
  const svg = makeSvg(program, index);
  await sharp(Buffer.from(svg))
    .resize(1200, 1100, { fit: "cover" })
    .webp({ quality: 84, effort: 5 })
    .toFile(outputPath);
  const stat = await fs.stat(outputPath);
  manifest.push({
    id: program.id,
    slug: program.slug,
    title: program.title,
    college_name: program.college_name,
    kind: kindFor(program),
    output_path: outputPath,
    filename,
    bytes: stat.size,
  });
}

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const totalBytes = manifest.reduce((sum, item) => sum + item.bytes, 0);
console.log(JSON.stringify({ programs: manifest.length, total_bytes: totalBytes, output_dir: outputDir, manifest: manifestPath }, null, 2));
