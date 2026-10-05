import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RichText } from "@/components/detail/RichText";
import { splitAtEditorialBoundary } from "./articleEditorialSplit";

describe("mid-article ad boundary", () => {
  it("keeps a writer-authored multi-column table intact", () => {
    const rows = Array.from({ length: 9 }, (_, index) =>
      `<tr>${["Physics", "Core chapter", "25% - 30%", `Practice focus ${index + 1}`].map((value) => `<td><p>${value}</p></td>`).join("")}</tr>`,
    ).join("");
    const html = `<h2>Subject guide</h2><p>${"Intro text. ".repeat(30)}</p><h2>Consolidated Subject-Wise Weightage Breakdown</h2><p>Expected weightage by subject.</p><table><tbody>${rows}</tbody></table><h2>Next steps</h2><p>${"Further guidance. ".repeat(30)}</p>`;
    const [before, after] = splitAtEditorialBoundary(html, true);

    expect(before + after).toBe(html);
    expect(before.includes("<table>") && !before.includes("</table>")).toBe(false);
    expect(after.includes("<table>") && !after.includes("</table>")).toBe(false);

    const { container } = render(<><RichText html={before} /><RichText html={after} /></>);
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(container.querySelectorAll("table tr")).toHaveLength(9);
    expect(container.querySelectorAll("table tr:first-child td")).toHaveLength(4);
  });

  it("does not cut nested blocks and retains markdown splitting", () => {
    const html = `<section><h2>Start</h2><p>${"Nested text. ".repeat(80)}</p><table><tr><td><p>Cell</p></td></tr></table></section><p>${"After text. ".repeat(80)}</p>`;
    const [before, after] = splitAtEditorialBoundary(html, true);
    expect(before + after).toBe(html);
    expect(before.includes("<section>") && !before.includes("</section>")).toBe(false);
    expect(after.includes("<section>") && !after.includes("</section>")).toBe(false);

    const [first, second] = splitAtEditorialBoundary("## Introduction\n\nFirst paragraph.\n\n## Next section\n\nSecond paragraph.", false);
    expect(first + second).toContain("Second paragraph.");
    expect(second).not.toBe("");
  });
});
