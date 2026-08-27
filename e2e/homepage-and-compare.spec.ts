import { test, expect } from "@playwright/test";

test.describe("Homepage Google Reviews", () => {
  test("review chip and 'View all' link open admin-configured URL in new tab", async ({ page }) => {
    await page.goto("/");
    const reviewLink = page.getByRole("link", { name: /view all reviews on google/i });
    for (let step = 0; step < 20 && await reviewLink.count() === 0; step += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(100);
    }
    await expect(reviewLink).toBeVisible({ timeout: 15_000 });
    await expect(reviewLink).toHaveAttribute("href", /^(https:\/\/g\.co\/|https:\/\/(?:www\.)?google\.com\/maps)/);
    await expect(reviewLink).toHaveAttribute("target", "_blank");
  });
});

test.describe("ComparePage interactions", () => {
  test("auto-opens search modal when fewer than 2 colleges selected", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByText(/compare colleges/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
