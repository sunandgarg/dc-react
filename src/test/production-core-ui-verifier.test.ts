import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("production core UI diagnostics", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts/verify-core-entity-ui.mjs"), "utf8");

  it("fails immediately on a page exception or rendered error state", () => {
    expect(source).toContain("Promise.race");
    expect(source).toContain('page.on("pageerror"');
    expect(source).toMatch(/not found\|page unavailable\|something went wrong/i);
  });

  it("reports the route, final URL, response errors, and failed requests", () => {
    expect(source).toContain("entity.route");
    expect(source).toContain("finalUrl=${page.url()}");
    expect(source).toContain('page.on("response"');
    expect(source).toContain('page.on("requestfailed"');
    expect(source).toContain("errorResponses=");
    expect(source).toContain("failedRequests=");
  });
});
