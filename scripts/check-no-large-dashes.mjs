#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = [
  "src",
  "scripts",
  "data/college-official-enrichment",
];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".html"]);
const violations = [];

async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      await scan(child);
      continue;
    }
    if (!allowedExtensions.has(extname(entry.name))) continue;
    const lines = (await readFile(child, "utf8")).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/[\u2013\u2014]/.test(line)) violations.push(`${child}:${index + 1}`);
    });
  }
}

for (const root of roots) await scan(root);

if (violations.length) {
  console.error(`Large dashes are forbidden. Use "-" instead:\n${violations.join("\n")}`);
  process.exit(1);
}

console.log("Typography check passed: no en or em dashes in active content paths.");
