import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import JeeMainAdPage from "./JeeMainAdPage";

vi.mock("@/hooks/useSEO", () => ({ useSEO: vi.fn() }));
vi.mock("@/components/LeadCaptureForm", () => ({ LeadCaptureForm: ({ title, subtitle, source }: { title: string; subtitle: string; source: string }) => <div data-source={source}>{title}<p>{subtitle}</p></div> }));
vi.mock("@/components/FAQSection", () => ({ FAQSection: ({ title }: { title: string }) => <h2>{title}</h2> }));

function open(slug: string) {
  render(<MemoryRouter initialEntries={[`/ad/${slug}`]}><Routes><Route path="/ad/:slug" element={<JeeMainAdPage />} /></Routes></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

describe("JEE Main ad pages", () => {
  it("keeps the English guidance form separate from the official application", () => {
    open("jee-main-2027");
    expect(screen.getByRole("link", { name: "Go to the official NTA application portal" })).toHaveAttribute("href", "https://jeemain.nta.nic.in/");
    expect(screen.getByText("This optional DekhoCampus form is for guidance and updates. It is not an NTA application form.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /NTA notice dated 30 October 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "JEE Main 2027 application questions" })).toBeInTheDocument();
    expect(screen.getByText("Get JEE Main guidance from DekhoCampus").closest("[data-source]")).toHaveAttribute("data-source", "JEE-paid");
    expect(screen.getByRole("heading", { name: "Application fee for one paper at an Indian centre" })).toBeInTheDocument();
  });

  it("renders Hindi copy and stops showing the time-sensitive video after the application window", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-27T00:00:00Z"));
    open("jee-main-2027-hi");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("आवेदन");
    expect(screen.getByText("यह DekhoCampus का वैकल्पिक मार्गदर्शन फॉर्म है, NTA का आवेदन फॉर्म नहीं।")).toBeInTheDocument();
    expect(screen.queryByLabelText("आवेदन के चरण वीडियो में देखें")).not.toBeInTheDocument();
  });
});
