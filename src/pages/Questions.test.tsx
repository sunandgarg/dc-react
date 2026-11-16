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
    expect(screen.getByRole("link", { name: /JEE Main: Browse question papers/ })).toHaveAttribute("href", "/ad/jee-main-2027#question-papers");
    expect(screen.getByRole("img", { name: "JEE Main logo" })).toHaveAttribute("src", expect.stringContaining("/exam-logos/official-v1/"));
  });

  it("links verified official papers and keeps guides distinct", () => {
    render(<MemoryRouter><Questions /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "School boards" }));
    expect(screen.getByRole("link", { name: /CBSE Class 12: Official sample papers/ })).toHaveAttribute("href", "https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html");
    expect(screen.queryByText("171 PDFs")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Engineering entrances" }));
    expect(screen.getByRole("link", { name: /WBJEE: Official paper archive/ })).toHaveAttribute("href", "https://wbjeeb.nic.in/old-question-paper-wbjee/");
    expect(screen.getByRole("link", { name: /AP EAPCET: Official 2026 papers/ })).toHaveAttribute("href", "https://cets.apsche.ap.gov.in/EAPCET/EAPCET/EAPCET_ExamPapers.aspx");
    expect(screen.getByRole("link", { name: /BITSAT: Explore exam guide/ })).toHaveAttribute("href", "/exams?search=BITSAT");
  });
});
