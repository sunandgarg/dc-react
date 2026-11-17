import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Questions, { QuestionCollection } from "./Questions";

vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/LeadGateDialog", () => ({ LeadGateDialog: ({ open }: { open: boolean }) => open ? <div role="dialog">Contact form</div> : null }));

afterEach(cleanup);

describe("questions directory", () => {
  it("filters exams immediately and links the available JEE archive", () => {
    render(<MemoryRouter><Questions /></MemoryRouter>);
    expect(screen.getAllByRole("article")).toHaveLength(25);
    expect(screen.getByRole("navigation", { name: "Exam categories" }).querySelector('a[href="#cbse"]')).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "jee main" } });
    expect(screen.getByRole("heading", { name: "JEE Main" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "NEET UG" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "JEE Main: Chapter-wise" })).toHaveAttribute("href", "/pyq-pdfs/past-years/jee/jee-main");
    expect(screen.getByRole("link", { name: "JEE Main: Year-wise papers" })).toHaveAttribute("href", "/pyq-pdfs/past-years/year-wise/jee/jee-main");
    expect(screen.getByRole("link", { name: /JEE Main: Timed practice on DekhoExams/ })).toHaveAttribute("href", "https://dekhoexams.com/questions/jee-main/practice");
    expect(screen.getByRole("link", { name: /JEE Main: Mockers on DekhoExams/ })).toHaveAttribute("href", "https://dekhoexams.com/");
    expect(screen.getByRole("link", { name: "JEE Main: Browse question papers" })).toHaveAttribute("href", "/ad/jee-main-2027#question-papers");
    expect(screen.getByRole("img", { name: "JEE Main logo" })).toHaveAttribute("src", expect.stringContaining("/exam-logos/official-v1/"));
  });

  it("links verified official papers and keeps guides distinct", () => {
    render(<MemoryRouter><Questions /></MemoryRouter>);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "CBSE" } });
    expect(screen.getByRole("link", { name: /CBSE Class 12: Official sample papers/ })).toHaveAttribute("href", "https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html");
    expect(screen.getByRole("link", { name: "CBSE Class 12: Chapter-wise" })).toHaveAttribute("href", "/pyq-pdfs/past-years/cbse/cbse-12");
    expect(screen.getByRole("img", { name: "CBSE Class 12 logo" })).toHaveAttribute("src", "/exam-logos/official-v1/e87b6e234f2120e27c79719b.webp");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "UPSC" } });
    expect(screen.getByRole("img", { name: "UPSC logo" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "NDA" } });
    expect(screen.getByRole("img", { name: "UPSC logo" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(screen.getAllByRole("img", { name: "UPSC logo" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /WBJEE: Official paper archive/ })).toHaveAttribute("href", "https://wbjeeb.nic.in/old-question-paper-wbjee/");
    expect(screen.getByRole("link", { name: /AP EAPCET: Official 2026 papers/ })).toHaveAttribute("href", "https://cets.apsche.ap.gov.in/EAPCET/EAPCET/EAPCET_ExamPapers.aspx");
    expect(screen.getByRole("link", { name: "BITSAT: Year-wise papers" })).toHaveAttribute("href", "/pyq-pdfs/past-years/year-wise/jee/bitsat");
  });

  it("shows owned JEE Main papers on the year-wise route", () => {
    render(<MemoryRouter initialEntries={["/pyq-pdfs/past-years/year-wise/jee/jee-main"]}><Routes><Route path="/pyq-pdfs/past-years/year-wise/:category/:exam" element={<QuestionCollection />} /></Routes></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "JEE Main year-wise question papers" })).toBeInTheDocument();
    expect(screen.getByText("2026", { selector: "summary span" })).toBeInTheDocument();
    expect(screen.getByText(/complete 171-paper ZIP/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("2026", { selector: "summary span" }));
    fireEvent.click(screen.getAllByRole("button", { name: /shift PDF/ })[0]);
    expect(screen.getByRole("dialog", { name: "" })).toHaveTextContent("Contact form");
  });
});
