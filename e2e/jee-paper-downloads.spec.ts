import { test, expect, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
const papers = JSON.parse(readFileSync(new URL("../src/data/jeeMainPapers.json", import.meta.url), "utf8")) as { year: number; dates: { morning: string | null; evening: string | null }[] }[];

const root = "https://aws-origin.dekhocampus.com/storage/v1/object/public/study-material/jee-main/2022-2026/";
const zip = root + "DekhoCampus_JEE_Main_2022_2026_All_106_Papers.zip";
const resources = [zip, ...papers.flatMap(year => year.dates.flatMap(date => [date.morning, date.evening].filter((url): url is string => Boolean(url))))];

test("all 107 mobile downloads retain their destination after completing the real form", async ({ browser }) => {
  test.setTimeout(600_000);
  const context = await browser.newContext({ ...devices["iPhone 13"], baseURL: process.env.E2E_BASE_URL || "http://localhost:8080" });
  const page = await context.newPage();
  const writes: any[] = [];
  // Exercise production UI without adding fake leads, sending SMS or dispatching CRM messages.
  await page.route("**/v1/**", route => route.fulfill({ json: [] }));
  await page.route("**/auth/v1/**", route => route.fulfill({ json: { user: null } }));
  await page.route("**/v1/functions/save-lead", route => {
    const body = route.request().postDataJSON();
    writes.push(body);
    return route.fulfill({ json: { success: true, lead_id: "download-regression", phase: body.phase } });
  });
  const requested: string[] = [];
  await page.route(root + "**", route => {
    requested.push(route.request().url());
    return route.fulfill({ headers: { "content-disposition": 'attachment; filename="checked-download.bin"' }, contentType: "application/octet-stream", body: "download navigation test" });
  });
  await page.goto("/ad/jee-main-2027#question-papers");
  await expect(page.getByRole("button", { name: "Download all 106 papers (.zip)" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#question-papers details").evaluateAll(details => details.forEach(detail => { (detail as HTMLDetailsElement).open = true; }));
  for (const [index, url] of resources.entries()) {
    if (url === zip) await page.getByRole("button", { name: "Download all 106 papers (.zip)" }).click();
    else await page.locator(`#question-papers a[href="${url}"]`).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => el.getBoundingClientRect().right <= innerWidth && el.getBoundingClientRect().left >= 0)).toBe(true);
    await dialog.getByPlaceholder("Your name *").fill("Download Regression Test");
    await dialog.getByPlaceholder("Email address *").fill("download-regression@example.com");
    await dialog.getByPlaceholder("Mobile number *").fill("9876543210");
    await dialog.getByRole("button", { name: "Save & continue" }).click();
    await expect(dialog.getByRole("button", { name: "Complete request" })).toBeEnabled();
    await dialog.locator("select").selectOption("B.Tech / B.E.");
    if (await dialog.getByRole("button", { name: "State *", exact: true }).count()) {
    await dialog.getByRole("button", { name: "State *", exact: true }).click();
    await page.locator("#searchable-select-portal-active").getByRole("button", { name: "Haryana", exact: true }).click();
    await dialog.getByRole("button", { name: "City *", exact: true }).click();
    await page.locator("#searchable-select-portal-active").getByRole("button", { name: "Gurugram", exact: true }).click();
    }
    const downloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Complete request" }).click();
    const download = await downloading;
    expect(download.url()).toBe(url);
    await download.delete();
    await expect(dialog).not.toBeVisible();
    expect(requested).toHaveLength(index + 1);
    expect(writes.at(-1)).toMatchObject({ phase: "complete", lead_id: "download-regression", source: "JEE-paid", interested_exam_slug: "jee-main", city: "Gurugram", state: "Haryana" });
  }
  expect(requested).toEqual(resources);
  expect(writes).toHaveLength(214);
  await context.close();
});
