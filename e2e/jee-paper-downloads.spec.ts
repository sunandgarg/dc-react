import { test, expect, devices, type Browser } from "@playwright/test";
import { readFileSync } from "node:fs";
const papers = JSON.parse(readFileSync(new URL("../src/data/jeeMainPapers.json", import.meta.url), "utf8")) as { year: number; dates: { morning: string | null; evening: string | null }[] }[];
const root = "https://aws-origin.dekhocampus.com/storage/v1/object/public/study-material/jee-main/2022-2026/";
const resources = papers.flatMap(year => year.dates.flatMap(date => [date.morning, date.evening].filter((url): url is string => Boolean(url))));

async function openDownloads(browser: Browser) {
  const context = await browser.newContext({ ...devices["iPhone 13"], baseURL: process.env.E2E_BASE_URL || "http://localhost:8080" });
  const page = await context.newPage();
  const writes: any[] = [];
  const bundleRequests: any[] = [];
  // Isolate writes and SMS while testing the real form and navigation code.
  await page.route(/\/v1\/(?:rest|functions)\//, route => route.fulfill({ json: [] }));
  await page.route("**/auth/v1/**", route => route.fulfill({ json: { user: null } }));
  await page.route("**/v1/functions/save-lead", route => {
    const body = route.request().postDataJSON(); writes.push(body);
    return route.fulfill({ json: { success: true, lead_id: "download-regression", phase: body.phase } });
  });
  await page.route("**/v1/functions/send-otp", route => {
    const body = route.request().postDataJSON();
    return route.fulfill(body.action !== "verify" ? { json: { success: true } } : body.otp === "123456" ? { json: { verified: true, verification_token: "verified-test-proof" } } : { status: 401, json: { message: "Invalid OTP" } });
  });
  const signed = root + "verified-bundle.zip";
  await page.route("**/v1/functions/jee-paper-bundle", route => {
    bundleRequests.push(route.request().postDataJSON());
    return route.fulfill({ json: { download_url: signed } });
  });
  const requested: string[] = [];
  await context.route(root + "**", route => {
    requested.push(route.request().url());
    return route.fulfill({ headers: { "content-disposition": 'attachment; filename="checked-download.bin"' }, contentType: "application/octet-stream", body: "download navigation test" });
  });
  await page.goto("/ad/jee-main-2027#question-papers");
  await expect(page.getByRole("button", { name: "Download all 106 papers (.zip)" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  return { context, page, writes, bundleRequests, requested, signed };
}

test("all 106 PDFs download directly without a form on mobile", async ({ browser }) => {
  test.setTimeout(600_000);
  const { context, page, writes, requested } = await openDownloads(browser);
  await page.locator("#question-papers details").evaluateAll(details => details.forEach(detail => { (detail as HTMLDetailsElement).open = true; }));
  for (const url of resources) {
    const downloading = page.waitForEvent("download");
    await page.locator(`#question-papers a[href="${url}"]`).click();
    const download = await downloading; expect(download.url()).toBe(url); await download.delete();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  expect(writes).toHaveLength(0);
  expect(requested).toEqual(resources);
  await context.close();
});

test("ZIP requires verified OTP before form completion and signed download", async ({ browser }) => {
  test.setTimeout(90_000);
  const { context, page, writes, bundleRequests, requested, signed } = await openDownloads(browser);
  await page.getByRole("button", { name: "Download all 106 papers (.zip)" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Your name *").fill("Download Regression Test");
  await dialog.getByPlaceholder("Email address *").fill("download-regression@example.com");
  await dialog.getByPlaceholder("Mobile number *").fill("9876543210");
  await dialog.getByRole("button", { name: "Save & continue" }).click();
  expect(writes).toHaveLength(0);
  await expect(dialog.getByText("OTP verification is required to download all 106 papers.")).toBeVisible();
  await dialog.getByRole("button", { name: "Get OTP" }).click();
  await dialog.getByPlaceholder("Enter 6-digit OTP sent via SMS").fill("000000");
  await dialog.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText("Invalid OTP", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Save & continue" }).click();
  expect(writes).toHaveLength(0);
  await dialog.getByPlaceholder("Enter 6-digit OTP sent via SMS").fill("123456");
  await dialog.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Verified", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Save & continue" }).click();
  await expect(dialog.getByRole("button", { name: "Complete request" })).toBeEnabled();
  await dialog.locator("select").selectOption("B.Tech / B.E.");
  await dialog.getByRole("button", { name: "State *", exact: true }).click();
  await page.locator("#searchable-select-portal-active").getByRole("button", { name: "Haryana", exact: true }).click();
  await dialog.getByRole("button", { name: "City *", exact: true }).click();
  await page.locator("#searchable-select-portal-active").getByRole("button", { name: "Gurugram", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Complete request" }).click();
  const download = await downloading; expect(download.url()).toBe(signed); await download.delete();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({ otp_verified: true, otp_verification_token: "verified-test-proof", phase: "complete" });
  expect(bundleRequests).toEqual([{ phone: "9876543210", otp_verification_token: "verified-test-proof" }]);
  expect(requested).toEqual([signed]);
  await context.close();
});
