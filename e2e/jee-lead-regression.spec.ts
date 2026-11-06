import { test, expect, type Page, type Locator } from "@playwright/test";

async function openLanding(page: Page) {
  // Every backend request is intercepted; these tests cannot create real leads or send SMS.
  await page.route("**/v1/**", route => route.fulfill({ json: [] }));
  await page.route("**/auth/v1/**", route => route.fulfill({ json: { user: null } }));
  await page.goto("/ad/jee-main-2027");
  await expect(page.getByPlaceholder("Your name *").first()).toBeVisible();
  return page.locator("form").first();
}

async function identity(form: Locator) {
  await form.getByPlaceholder("Your name *").fill("Regression Student");
  await form.getByPlaceholder("Email address *").fill("regression@example.com");
  await form.getByPlaceholder("Mobile number *").fill("9876543210");
}

async function preferences(page: Page, form: Locator) {
  await form.locator("select").selectOption("B.Tech / B.E.");
  await form.getByRole("button", { name: "State *", exact: true }).click();
  await page.locator("#searchable-select-portal-active").getByRole("button", { name: "Haryana", exact: true }).click();
  await form.getByRole("button", { name: "City *", exact: true }).click();
  await page.locator("#searchable-select-portal-active").getByRole("button", { name: "Gurugram", exact: true }).click();
}

for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]] as const) {
  test.describe(label, () => {
    test.use({ viewport });

    test("both forms retain validation, branding and a usable mobile layout", async ({ page }) => {
      const form = await openLanding(page);
      await expect(page.getByPlaceholder("Your name *")).toHaveCount(2);
      await expect(page.locator('img[alt="DekhoCampus"]').first()).toHaveCSS("filter", "grayscale(1)");
      await form.getByRole("button", { name: "Save & continue" }).click();
      await expect(form.getByPlaceholder("Your name *")).toBeVisible();
      await expect(form.locator("select")).toHaveCount(0);
      await expect(form.getByRole("button", { name: "Get OTP" })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const secondary = page.locator("form").nth(1);
      await identity(secondary);
      await expect(secondary.getByRole("button", { name: "Get OTP" })).toBeEnabled();
    });

    test("slow save opens step two immediately and completes the same lead once", async ({ page }) => {
      const form = await openLanding(page);
      const writes: any[] = [];
      let release!: () => void;
      const saving = new Promise<void>(resolve => { release = resolve; });
      await page.route("**/v1/functions/save-lead", async route => {
        const body = route.request().postDataJSON(); writes.push(body);
        if (body.phase === "identity") await saving;
        await route.fulfill({ json: { success: true, lead_id: "regression-id", phase: body.phase } });
      });
      await identity(form);
      await form.getByRole("button", { name: "Save & continue" }).click();
      await expect(form.locator("select")).toBeVisible({ timeout: 1000 });
      await expect(form.getByRole("button", { name: "Saving details…" })).toBeDisabled();
      await preferences(page, form);
      expect(writes).toHaveLength(1);
      release();
      await expect(form.getByRole("button", { name: "Complete request" })).toBeEnabled();
      await form.getByRole("button", { name: "Complete request" }).click();
      await expect(page.getByText(/Thank you|You're all set/i).first()).toBeVisible();
      expect(writes).toHaveLength(2);
      expect(writes[1]).toMatchObject({ lead_id: "regression-id", phase: "complete", state: "Haryana", city: "Gurugram", interested_exam_slug: "jee-main", otp_verified: false });
    });

    test("failed save preserves identity and allows an explicit retry", async ({ page }) => {
      const form = await openLanding(page);
      let count = 0;
      await page.route("**/v1/functions/save-lead", route => {
        count++;
        return route.fulfill(count === 1 ? { status: 503, json: { message: "Database temporarily unavailable" } } : { json: { success: true, lead_id: "retry-id", phase: "identity" } });
      });
      await identity(form);
      await form.getByRole("button", { name: "Save & continue" }).click();
      await expect(form.getByPlaceholder("Email address *")).toHaveValue("regression@example.com");
      await expect(page.getByText("Database temporarily unavailable", { exact: true })).toBeVisible();
      await form.getByRole("button", { name: "Save & continue" }).click();
      await expect(form.getByRole("button", { name: "Complete request" })).toBeEnabled();
      expect(count).toBe(2);
    });

    test("OTP send, invalid code, verification and phone correction preserve the gate", async ({ page }) => {
      const form = await openLanding(page);
      let sends = 0;
      await page.route("**/v1/functions/send-otp", async route => {
        const body = route.request().postDataJSON();
        if (body.action !== "verify") { sends++; return route.fulfill({ json: { success: true } }); }
        return route.fulfill(body.otp === "123456" ? { json: { success: true, verified: true, verification_token: "test-proof" } } : { status: 401, json: { message: "Invalid or expired OTP" } });
      });
      await identity(form);
      await form.getByRole("button", { name: "Get OTP" }).click();
      await expect(form.getByPlaceholder("Enter 6-digit OTP sent via SMS")).toBeVisible();
      await form.getByRole("button", { name: "Save & continue" }).click();
      await expect(form.locator("select")).toHaveCount(0);
      await form.getByPlaceholder("Enter 6-digit OTP sent via SMS").fill("000000");
      await form.getByRole("button", { name: "Verify", exact: true }).click();
      await expect(page.getByText("Invalid or expired OTP", { exact: true })).toBeVisible();
      await form.getByPlaceholder("Enter 6-digit OTP sent via SMS").fill("123456");
      await form.getByRole("button", { name: "Verify", exact: true }).click();
      await expect(form.getByRole("button", { name: "Verified", exact: true })).toBeDisabled();
      await form.getByPlaceholder("Mobile number *").fill("9876543211");
      await expect(form.getByRole("button", { name: "Get OTP" })).toBeEnabled();
      expect(sends).toBe(1);
    });
  });
}
