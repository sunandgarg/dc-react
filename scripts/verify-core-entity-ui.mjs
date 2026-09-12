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

function observeEntityPage(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  const errorResponses = [];
  let rejectPageError;
  const firstPageError = new Promise((_, reject) => { rejectPageError = reject; });
  // The navigation may surface a page error before goto() resolves and before
  // the marker race starts. Keep that rejection handled while preserving it
  // for the later race.
  void firstPageError.catch(() => {});

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
    rejectPageError(new Error(`Page error: ${error.message}`));
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.failure()?.errorText || "request failed"} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errorResponses.push(`${response.status()} ${response.url()}`);
  });

  return { pageErrors, consoleErrors, failedRequests, errorResponses, firstPageError };
}

async function waitForEntityMarker(page, entity, viewport, navigationStatus, diagnostics) {
  const marker = page.getByText(entity.marker, { exact: false }).first();
  const renderedError = page.getByText(/not found|page unavailable|something went wrong/i).first();
  try {
    await Promise.race([
      marker.waitFor({ state: "visible", timeout: 30_000 }),
      diagnostics.firstPageError,
      renderedError.waitFor({ state: "visible", timeout: 30_000 }).then(async () => {
        throw new Error(`Rendered error state: ${(await renderedError.innerText()).slice(0, 240)}`);
      }),
    ]);
  } catch (error) {
    const body = await page.locator("body").innerText().catch(() => "");
    throw new Error([
      `${entity.route} did not render ${JSON.stringify(entity.marker)} at ${viewport.name}`,
      `navigation=${navigationStatus ?? "none"} finalUrl=${page.url()}`,
      `cause=${error instanceof Error ? error.message : String(error)}`,
      diagnostics.pageErrors.length ? `pageErrors=${diagnostics.pageErrors.join(" | ")}` : "",
      diagnostics.errorResponses.length ? `errorResponses=${diagnostics.errorResponses.join(" | ")}` : "",
      diagnostics.failedRequests.length ? `failedRequests=${diagnostics.failedRequests.join(" | ")}` : "",
      diagnostics.consoleErrors.length ? `consoleErrors=${diagnostics.consoleErrors.join(" | ")}` : "",
      body ? `body=${body.replace(/\s+/g, " ").slice(0, 800)}` : "",
    ].filter(Boolean).join("; "), { cause: error });
  }

  return diagnostics;
}

try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    if (expectedPhase === "create") {
      const homepage = await context.newPage();
      const homepageErrors = [];
      homepage.on("pageerror", (error) => homepageErrors.push(error.message));
      await homepage.goto(`${baseUrl}/?core-regression=${encodeURIComponent(manifest.runToken)}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const exploreHeading = homepage.locator("#explore-heading");
      for (let top = 700; top <= 4_200 && await exploreHeading.count() === 0; top += 700) {
        await homepage.evaluate((scrollTop) => window.scrollTo({ top: scrollTop, behavior: "auto" }), top);
        await homepage.waitForTimeout(400);
      }
      await exploreHeading.waitFor({ state: "visible", timeout: 30_000 });
      await exploreHeading.scrollIntoViewIfNeeded();
      for (const entity of manifest.entities.filter(({ table }) => ["colleges", "courses", "exams"].includes(table))) {
        await homepage.locator(`a[href="${entity.route}"]`).first().waitFor({ state: "visible", timeout: 30_000 });
        checks.push({ table: entity.table, phase: expectedPhase, viewport: viewport.name, route: "/#explore-by-category", status: 200 });
      }
      if (homepageErrors.length) throw new Error(`Homepage page errors: ${homepageErrors.join("; ")}`);
      await homepage.close();
    }
    for (const entity of manifest.entities) {
      const page = await context.newPage();
      const diagnostics = observeEntityPage(page);
      const response = await page.goto(`${baseUrl}${entity.route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      if (!response?.ok()) throw new Error(`${entity.route} navigation returned ${response?.status() ?? "no response"}`);
      await waitForEntityMarker(page, entity, viewport, response.status(), diagnostics);
      const body = await page.locator("body").innerText();
      if (/not found|page unavailable|something went wrong/i.test(body)) throw new Error(`${entity.route} rendered an error state`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error(`${entity.route} has ${overflow}px horizontal overflow at ${viewport.name}`);
      if (diagnostics.pageErrors.length) throw new Error(`${entity.route} page errors: ${diagnostics.pageErrors.join("; ")}`);
      checks.push({ table: entity.table, phase: expectedPhase, viewport: viewport.name, route: entity.route, status: response?.status() });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, phase: expectedPhase, checks: checks.length, results: checks }, null, 2));
