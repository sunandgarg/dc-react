import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Questions from "./Questions";

vi.mock("@/components/SEO", () => ({ SEO: () => null }));

afterEach(cleanup);

describe("questions directory", () => {
  it("filters exams immediately and links the available JEE archive", () => {
    render(<MemoryRouter><Questions /></MemoryRouter>);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "jee main" } });
    expect(screen.getByRole("heading", { name: "JEE Main" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "NEET UG" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /JEE Main: Browse question papers/ })).toHaveAttribute("href", "/ad/jee-main-2027#question-papers");
    expect(screen.getByRole("link", { name: "JEE Main: Exam overview" })).toHaveAttribute("href", "/exams?search=JEE%20Main");
    expect(screen.getByRole("img", { name: "JEE Main logo" })).toHaveAttribute("src", expect.stringContaining("/exam-logos/official-v1/"));
  });

  it("links verified official papers and keeps guides distinct", () => {
    render(<MemoryRouter><Questions /></MemoryRouter>);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "CBSE" } });
    expect(screen.getByRole("link", { name: /CBSE Class 12: Official sample papers/ })).toHaveAttribute("href", "https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html");
    expect(screen.getByRole("link", { name: "CBSE Class 12: Study resources" })).toHaveAttribute("href", "/resources");
    expect(screen.getByRole("img", { name: "CBSE Class 12 logo" })).toHaveAttribute("src", "/exam-logos/official-v1/e87b6e234f2120e27c79719b.webp");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "UPSC" } });
    expect(screen.getByRole("img", { name: "UPSC logo" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "NDA" } });
    expect(screen.getByRole("img", { name: "UPSC logo" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(screen.getAllByRole("img", { name: "UPSC logo" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /WBJEE: Official paper archive/ })).toHaveAttribute("href", "https://wbjeeb.nic.in/old-question-paper-wbjee/");
    expect(screen.getByRole("link", { name: /AP EAPCET: Official 2026 papers/ })).toHaveAttribute("href", "https://cets.apsche.ap.gov.in/EAPCET/EAPCET/EAPCET_ExamPapers.aspx");
    expect(screen.getByRole("link", { name: "BITSAT: Exam overview" })).toHaveAttribute("href", "/exams?search=BITSAT");
    expect(screen.getByRole("link", { name: "BITSAT: Study resources" })).toHaveAttribute("href", "/resources");
  });
});
