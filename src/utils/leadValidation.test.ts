import { describe, expect, it } from "vitest";
import { generateLeadsCSV, type Lead } from "./leadValidation";

describe("generateLeadsCSV", () => {
  it("uses spreadsheet-safe encoding for lead and custom fields", () => {
    const lead: Lead = {
      name: " =HYPERLINK(\"https://example.test\")",
      email: "student@example.test",
      mobile: "+919999999999",
      risky_custom: "\t@SUM(1,2)",
    };
    const csv = generateLeadsCSV([lead], ["risky_custom"]);
    expect(csv).toContain('"\' =HYPERLINK(""https://example.test"")"');
    expect(csv).toContain("'+919999999999");
    expect(csv).toContain('"\'\t@SUM(1,2)"');
  });
});
