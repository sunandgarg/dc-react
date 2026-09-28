import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CategorySection } from "./CategorySection";

vi.mock("@/hooks/useStreamCategories", () => ({ useStreamCategories: () => ({ data: [{ id: "Engineering", label: "Engineering", emoji: "" }] }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useCollegesData", () => ({ useHomepageCategoryColleges: () => ({ data: [{ slug: "example-college", name: "Example College", city: "Delhi", rating: 4.5 }] }) }));
vi.mock("@/hooks/useCoursesData", () => ({ useHomepageCategoryCourses: () => ({ data: [
  { slug: "aeronautical-engineering", name: "Aeronautical Engineering Courses", colleges_count: 0 },
  { slug: "btech-computer-science", name: "Btech Computer Science", colleges_count: 0 },
] }) }));
vi.mock("@/hooks/useExamsData", () => ({ useHomepageCategoryExams: () => ({ data: [{ slug: "jee-main", name: "Joint Entrance Examination", short_name: "JEE Main" }] }) }));

describe("category panel alignment", () => {
  it("uses the same row size and stretchable list layout in all three panels", () => {
    const { container } = render(<MemoryRouter><CategorySection /></MemoryRouter>);
    const rows = ["/colleges/example-college", "/courses/aeronautical-engineering", "/exams/jee-main"]
      .map((href) => container.querySelector(`a[href="${href}"]`));
    for (const row of rows) {
      expect(row).toHaveClass("min-h-[76px]", "items-center", "p-2.5");
      expect(row?.parentElement).toHaveClass("grid", "auto-rows-fr", "flex-1");
      expect(row?.parentElement?.parentElement).toHaveClass("flex", "flex-col");
    }
    const course = rows[1]!;
    expect(course.querySelector("h4")).toHaveClass("line-clamp-2");
    expect(course.querySelector("span[aria-hidden='true']")).toHaveClass("h-12", "w-12");
    expect(course.querySelector("svg.lucide-arrow-right")).not.toBeNull();
    expect(screen.getAllByText("Eligibility, subjects & careers")).toHaveLength(2);
    const featured = screen.getByRole("link", { name: /B.Tech Computer Science/ });
    expect(featured).toHaveAttribute("href", "/courses/btech-computer-science");
    expect(featured.querySelector("h4")).toHaveAttribute("title", "Btech Computer Science");
    expect(screen.getByText("Popular & emerging programmes")).toBeInTheDocument();
    expect(course.textContent).not.toMatch(/0\+?\s+colleges/i);
  });
});
