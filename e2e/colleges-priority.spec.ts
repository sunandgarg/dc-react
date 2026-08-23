import { test, expect } from "@playwright/test";

test.describe("Colleges listing - priority & featured ordering", () => {
  async function expectFirstApiRowFirst(page: any, path: string) {
    const directoryResponse = page.waitForResponse((response: any) =>
      response.url().includes("/v1/rest/colleges?") &&
      response.url().includes("featured_rank") &&
      response.url().includes("limit=24") &&
      response.status() === 200,
    );
    await page.goto(path);
    const rows = await (await directoryResponse).json();
    if (!rows.length) {
      await expect(page.getByText(/no colleges match|showing 0 loaded colleges/i).first()).toBeVisible();
      return;
    }

    const firstCardTitle = page.locator("article h2").first();
    await expect(firstCardTitle).toBeVisible({ timeout: 15_000 });
    await expect(firstCardTitle).toHaveText(rows[0].short_name || rows[0].name);
    const featuredBadge = page.locator('[data-testid="featured-rank-badge"]').first();
    if (rows[0].featured_rank) await expect(featuredBadge).toContainText(`Featured #${rows[0].featured_rank}`);
  }

  test("Engineering filter renders the first ranked API row first", async ({ page }) => {
    await expectFirstApiRowFirst(page, "/colleges/top-engineering-colleges-in-india");
  });

  test("unfiltered directory renders the first ranked API row first", async ({ page }) => {
    await expectFirstApiRowFirst(page, "/colleges");
  });
});
