import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("college detail summary layout", () => {
  const hero = readFileSync(resolve(process.cwd(), "src/components/CollegeHeroCard.tsx"), "utf8");
  const stats = readFileSync(resolve(process.cwd(), "src/components/detail/CollegeTrustBento.tsx"), "utf8");
  const detail = readFileSync(resolve(process.cwd(), "src/pages/CollegeDetail.tsx"), "utf8");

  it("uses one primary treatment for hero badges and actions", () => {
    expect(hero).toMatch(/heroBadgeClass/);
    expect(hero).toMatch(/secondaryActionClass/);
    expect(hero).not.toMatch(/bg-success\/90|bg-accent\/90|border-red-500|border-blue-500/);
  });

  it("shows the requested four summary facts only once", () => {
    expect(stats).toMatch(/label: "Rating"/);
    expect(stats).toMatch(/label: "Courses"/);
    expect(stats).toMatch(/label: "Avg Package"/);
    expect(stats).toMatch(/label: "Type"/);
    expect(stats).not.toMatch(/label: "Course Fees"|label: "Student Rating"/);
    expect(detail.match(/<CollegeTrustBento college=\{college\} \/>/g)).toHaveLength(1);
    expect(detail).not.toMatch(/CollegeQuickFacts/);
    expect(detail).not.toMatch(/\{ icon: Star, label: "Rating"/);
  });

  it("shows a university-specific institution type when the stored type is generic", () => {
    expect(stats).toMatch(/displayInstitutionType/);
    expect(stats).toMatch(/`\$\{type\} University`/);
  });
});
