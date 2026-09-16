import { describe, expect, it } from "vitest";
import { plainText } from "./plainText";

describe("plainText", () => {
  it("removes rich-text tags from article summaries", () => {
    expect(plainText("<p>Check JEE Main <strong>2027</strong> dates.</p>"))
      .toBe("Check JEE Main 2027 dates.");
  });

  it("decodes entities and discards executable content", () => {
    expect(plainText("<p>Fees &amp; eligibility</p><script>alert('x')</script>"))
      .toBe("Fees & eligibility");
  });
});
