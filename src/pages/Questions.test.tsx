import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Questions from "./Questions";

vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));

afterEach(cleanup);

describe("questions directory", () => {
  it("filters exams immediately and links the available JEE archive", () => {
    render(<MemoryRouter><Questions /></MemoryRouter>);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "jee main" } });
    expect(screen.getByRole("heading", { name: "JEE Main" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "NEET UG" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /JEE Main Browse question papers/ })).toHaveAttribute("href", "/ad/jee-main-2027#question-papers");
  });

  it("keeps other exam cards as resource links without promising PDFs", () => {
    render(<MemoryRouter><Questions /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "School boards" }));
    expect(screen.getByRole("link", { name: /CBSE Class 12 Explore exam resources/ })).toHaveAttribute("href", "/study-material/class-12?board=cbse");
    expect(screen.queryByText("171 PDFs")).not.toBeInTheDocument();
  });
});
