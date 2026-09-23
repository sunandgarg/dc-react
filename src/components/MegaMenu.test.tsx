import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MegaMenu } from "@/components/MegaMenu";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { colleges: [], courses: [], exams: [] } }),
}));

function openSection(name: string) {
  render(<MemoryRouter><MegaMenu /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
}

describe("MegaMenu listing filters", () => {
  it("uses the exam stream and supported exam levels", () => {
    openSection("Exams");
    expect(screen.getByRole("menuitem", { name: /Engineering/ })).toHaveAttribute("href", "/exams?stream=Engineering");
    expect(screen.getByRole("menuitem", { name: /Undergraduate/ })).toHaveAttribute("href", "/exams?level=UG");
    expect(screen.getByRole("menuitem", { name: /After Class 10/ })).toHaveAttribute("href", "/exams?level=10th");
  });

  it("uses course levels supported by the live catalog", () => {
    openSection("Courses");
    expect(screen.getByRole("menuitem", { name: /Certificate/ })).toHaveAttribute("href", "/courses?level=Certificate");
    expect(screen.getByRole("menuitem", { name: /Doctorate/ })).toHaveAttribute("href", "/courses?level=Doctoral");
  });

  it("uses live scholarship categories and study-board slugs", () => {
    openSection("Scholarships");
    expect(screen.getByRole("menuitem", { name: /Corporate/ })).toHaveAttribute("href", "/scholarships?category=Corporate");
  });

  it("uses a real Bihar Board destination instead of a missing board", () => {
    openSection("Study Material");
    expect(screen.getByRole("menuitem", { name: /Bihar Board/ })).toHaveAttribute("href", "/study-material?board=bihar-board");
  });
});
