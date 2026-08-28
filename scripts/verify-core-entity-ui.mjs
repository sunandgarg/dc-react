#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const manifestPath = process.argv[2];
const expectedPhase = process.argv[3];
const baseUrl = String(process.env.PUBLIC_BASE_URL || "https://dekhocampus.com").replace(/\/$/, "");

if (!manifestPath || !expectedPhase) {
  throw new Error("Usage: verify-core-entity-ui.mjs <manifest.json> <create|edit>");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.phase !== expectedPhase) throw new Error(`Expected ${expectedPhase} manifest, received ${manifest.phase}`);

const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    for (const entity of manifest.entities) {
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const response = await page.goto(`${baseUrl}${entity.route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.getByText(entity.marker, { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });
      const body = await page.locator("body").innerText();
      if (/not found|page unavailable|something went wrong/i.test(body)) throw new Error(`${entity.route} rendered an error state`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error(`${entity.route} has ${overflow}px horizontal overflow at ${viewport.name}`);
      if (pageErrors.length) throw new Error(`${entity.route} page errors: ${pageErrors.join("; ")}`);
      checks.push({ table: entity.table, phase: expectedPhase, viewport: viewport.name, route: entity.route, status: response?.status() });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, phase: expectedPhase, checks: checks.length, results: checks }, null, 2));
