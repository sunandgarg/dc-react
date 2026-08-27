import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("homepage Explore by Category selection", () => {
  const categorySection = read("src/components/CategorySection.tsx");
  const collegeHook = read("src/hooks/useCollegesData.ts");
  const courseHook = read("src/hooks/useCoursesData.ts");
  const examHook = read("src/hooks/useExamsData.ts");
  const adminSources = [
    read("src/pages/AdminColleges.tsx"),
    read("src/pages/AdminCourses.tsx"),
    read("src/pages/AdminExams.tsx"),
  ];
  const schema = read("backend/prisma/schema.prisma");
  const rest = read("backend/src/rest.mjs");
  const parity = read("backend/scripts/apply-mysql-parity.mjs");

  it("uses category-scoped homepage hooks instead of loading complete entity datasets", () => {
    expect(categorySection).toMatch(/useHomepageCategoryColleges/);
    expect(categorySection).toMatch(/useHomepageCategoryCourses/);
    expect(categorySection).toMatch(/useHomepageCategoryExams/);
    expect(categorySection).not.toMatch(/useDbColleges/);
    expect(categorySection).not.toMatch(/useDbCourses/);
    expect(categorySection).not.toMatch(/useDbExams/);
  });

  it.each([
    ["colleges", collegeHook],
    ["courses", courseHook],
    ["exams", examHook],
  ])("%s uses checked rows first and only then defines the fallback", (_entity, source) => {
    expect(source).toMatch(/\.eq\("show_in_explore_by_category", true\)/);
    expect(source).toMatch(/\.order\("explore_by_category_checked_at", \{ ascending: false/);
    expect(source).toMatch(/if \(selected\.size > 0\)/);
    expect(source.indexOf("if (selected.size > 0)")).toBeLessThan(
      source.indexOf("const fallbackBase"),
    );
  });

  it("provides the homepage checkbox in all three admin editors", () => {
    for (const source of adminSources) {
      expect(source).toMatch(/Show in homepage Explore by Category/);
      expect(source).toMatch(/show_in_explore_by_category/);
      expect(source).toMatch(/explore_by_category_checked_at/);
    }
  });

  it("adds timestamp-maintained fields and MySQL indexes for all entity tables", () => {
    for (const table of ["colleges", "courses", "exams"]) {
      expect(schema).toContain(`ix_${table}_homepage_explore`);
    }
    expect(schema.match(/show_in_explore_by_category\s+Boolean\s+@default\(false\)/g)).toHaveLength(3);
    expect(schema.match(/explore_by_category_checked_at\s+DateTime\?/g)).toHaveLength(3);
    expect(rest).toMatch(/stampHomepageExploreSelection/);
    expect(rest).toMatch(/explore_by_category_checked_at: new Date\(\)\.toISOString\(\)/);
    expect(parity).toMatch(/ensureHomepageExploreSchema/);
    expect(parity).toMatch(/ADD COLUMN \\`show_in_explore_by_category\\` BOOLEAN NOT NULL DEFAULT FALSE/);
  });
});
