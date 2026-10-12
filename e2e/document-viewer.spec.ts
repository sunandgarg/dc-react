import { createRequire } from "node:module";
import { test, expect } from "@playwright/test";

const { PDFDocument } = createRequire(import.meta.url)("../backend/node_modules/pdf-lib");

for (const width of [390, 412, 1280]) {
  test(`document viewer renders and navigates a PDF at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]).drawText("Eligibility and admission requirements");
    pdf.addPage([400, 600]).drawText("Course fees and application documents");
    const bytes = Buffer.from(await pdf.save());
    await page.route("**/__document-fixture.pdf", route => route.fulfill({ contentType: "application/pdf", body: bytes }));
    await page.route("**/v1/**", route => route.fulfill({ contentType: "application/json", body: "[]" }));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      const { default: React } = await import(/* @vite-ignore */ "/node_modules/.vite/deps/react.js");
      const { default: ReactDOM } = await import(/* @vite-ignore */ "/node_modules/.vite/deps/react-dom_client.js");
      const { RichText } = await import(/* @vite-ignore */ "/src/components/detail/RichText.tsx");
      document.getElementById("root")!.style.display = "none";
      const mount = document.createElement("div");
      mount.id = "document-test";
      document.body.appendChild(mount);
      ReactDOM.createRoot(mount).render(React.createElement(RichText, { html: '<h2>Eligibility</h2><ul><li>Class 12 qualification</li></ul><div class="doc-viewer" data-title="Admission brochure" data-pdf="/__document-fixture.pdf"></div><p>After the document</p>' }));
    });
    const viewer = page.locator("#document-test");
    await expect(viewer.getByRole("heading", { name: "Eligibility" })).toBeVisible();
    await viewer.getByRole("button", { name: "View PDF document" }).click();
    await expect(viewer.getByText("1 of 2")).toBeVisible({ timeout: 15000 });
    await expect(viewer.getByRole("status")).toHaveCount(0, { timeout: 15000 });
    expect(await viewer.locator("canvas").evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBeGreaterThan(0);
    expect(await viewer.locator("canvas").evaluate(canvas => (canvas as HTMLCanvasElement).height)).toBeGreaterThan(0);
    await viewer.getByRole("button", { name: "Next page" }).click();
    await expect(viewer.getByText("2 of 2")).toBeVisible();
    await expect(viewer.getByRole("status")).toHaveCount(0);
    await viewer.getByRole("button", { name: "Zoom in" }).click();
    await expect(viewer.getByText("125%")).toBeVisible();
    await expect(viewer.getByRole("status")).toHaveCount(0);
    await viewer.getByRole("button", { name: "Fullscreen" }).click();
    await expect(viewer.locator("canvas")).toHaveCount(1);
    await expect(viewer.getByRole("status")).toHaveCount(0);
    await viewer.getByRole("button", { name: "Fullscreen" }).click();
    await expect(viewer.getByText("After the document")).toBeVisible();
    await expect(viewer.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
