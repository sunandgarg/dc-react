import { test, expect } from "@playwright/test";

const exam = {
  id: "exam-layout-fixture", slug: "pu-cet-ug", name: "PU CET (UG)", short_name: "PU CET UG",
  full_name: "PU CET UG 2027: Dates, Eligibility, Pattern",
  logo: "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/exam-logos-v2/pu-cet-ug.webp",
  is_active: true, status: "2027 official schedule not announced", category: "Science", level: "UG",
  listing_category: "Entrance", exam_streams: ["Science"], course_groups: ["B.Sc."], education_levels: ["UG"],
  mode: "Offline", duration: "70 minutes", exam_type: "University", language: "English", frequency: "Annual",
  application_mode: "Online", syllabus: [], top_colleges: [], question_papers: [],
  important_dates: [{ event: "2027 notification", date: "Not announced by Panjab University" }],
  updated_at: "2026-09-23T00:00:00.000Z", created_at: "2026-09-23T00:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.route(/\/v1\/rest\//, async (route) => {
    const url = new URL(route.request().url());
    const rows = url.pathname.endsWith("/exams") ? [exam] : [];
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": `0-${rows.length - 1}/${rows.length}` }, body: JSON.stringify(rows) });
  });
});

for (const width of [320, 390, 1440]) {
  test(`exam names remain visible with a long status at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/exams");
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "PU CET UG", exact: true }) });
    await expect(card).toBeVisible();
    const title = card.getByRole("heading", { name: "PU CET UG", exact: true });
    const fullName = card.getByText(/Panjab University Common Entrance Test/);
    await expect(fullName).toBeVisible();
    await expect(card.getByText(exam.status, { exact: true })).toBeVisible();
    const titleBounds = await title.boundingBox();
    const fullBounds = await fullName.boundingBox();
    expect(titleBounds!.width).toBeGreaterThan(100);
    expect(fullBounds!.y).toBeGreaterThan(titleBounds!.y);
    expect(await fullName.evaluate((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(card.getByRole("img", { name: "PU CET UG logo" })).toHaveAttribute("src", /^\/exam-logos\/official-v1\//);
    await expect.poll(() => card.getByRole("img", { name: "PU CET UG logo" }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await card.screenshot({ path: `test-results/exam-card-${width}.png` });
  });
}

test("detail uses the short name, expanded name and no decorative outer ring", async ({ page }) => {
  await page.goto("/exams/pu-cet-ug");
  await expect(page.getByRole("heading", { level: 1, name: "PU CET UG", exact: true })).toBeVisible();
  await expect(page.getByText(/Panjab University Common Entrance Test/).first()).toBeVisible();
  const logo = page.getByRole("img", { name: "PU CET UG logo" }).first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((el) => getComputedStyle(el.parentElement!).backgroundImage)).toBe("none");
});
