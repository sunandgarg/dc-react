import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { CourseCard } from "@/components/CourseCard";
import { CourseTrustBento } from "@/components/detail/CourseTrustBento";
import { CourseAIInsight } from "@/components/detail/CourseAIInsight";
import { CollegeTrustBento } from "@/components/detail/CollegeTrustBento";
import { CollegeAIInsight } from "@/components/detail/CollegeAIInsight";

describe("public course counts", () => {
  it.each([0, 666])("does not display count labels for %s courses/colleges in public cards or summaries", (count) => {
    const course: any = { slug: "example", name: "Example", category: "Engineering", duration: "4 years", colleges_count: count };
    const college = { ...course, courses_count: count, type: "Private" };
    const { container } = render(<MemoryRouter>
      <CourseCard course={course} index={0} /><CourseTrustBento course={course} /><CourseAIInsight course={course} />
      <CollegeTrustBento college={college} /><CollegeAIInsight college={college} />
    </MemoryRouter>);
    expect(container.textContent).not.toMatch(/\d+\+?\s+(?:colleges|courses)/i);
    expect(screen.queryByText("Colleges", { exact: true })).toBeNull();
    expect(screen.queryByText("Courses", { exact: true })).toBeNull();
  });

  it("removes count rendering from public course pages and category cards", () => {
    for (const file of ["src/pages/CourseDetail.tsx", "src/components/CategorySection.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("collegesCount");
      expect(source).not.toContain("colleges_count");
    }
    expect(readFileSync("src/components/HeroSection.tsx", "utf8")).not.toContain("840+ Courses");
    expect(readFileSync("src/pages/AllCourses.tsx", "utf8")).not.toContain("Explore {filtered.length}");
  });
});
