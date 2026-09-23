import { describe, expect, it } from "vitest";
import { addCbseSamplePaperLinks } from "./cbseSamplePaperLinks";

describe("CBSE sample-paper links", () => {
  const title = "CBSE Sample Papers 2027 Released for Class 10, 12: Download SQP";

  it("adds both verified class pages immediately below the download heading", () => {
    const result = addCbseSamplePaperLinks(title, "<h2>Click here to Download SQPs</h2><p>Choose a subject.</p>");
    expect(result).toContain('href="https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html"');
    expect(result).toContain('href="https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html"');
    expect(result.indexOf("Class 10 sample papers")).toBeLessThan(result.indexOf("Choose a subject."));
    expect(addCbseSamplePaperLinks(title, result)).toBe(result);
  });

  it("does not change other articles", () => {
    expect(addCbseSamplePaperLinks("JEE Main 2027", "<p>Body</p>")).toBe("<p>Body</p>");
  });
});
