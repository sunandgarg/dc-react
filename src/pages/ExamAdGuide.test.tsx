import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ExamAdGuide from "./ExamAdGuide";

vi.mock("@/hooks/useSEO", () => ({ useSEO: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav>Site navigation</nav> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer>Site footer</footer> }));
vi.mock("@/components/AuthorByline", () => ({ AuthorByline: () => <p>Geethika Reddy</p> }));
vi.mock("@/components/LeadCaptureForm", () => ({ LeadCaptureForm: ({ brandLogoUrl, brandName }: { brandLogoUrl: string; brandName: string }) => <form aria-label="DekhoCampus lead form"><img src={brandLogoUrl} alt={`${brandName} logo`} /></form> }));

function open(slug: Parameters<typeof ExamAdGuide>[0]["slug"]) {
  render(<MemoryRouter><ExamAdGuide slug={slug} /></MemoryRouter>);
}

describe("exam ad guides", () => {
  it.each(["jee-advanced-2027", "srmjeee-2027", "clat-2027", "cuet-2027", "viteee-2027"] as const)("follows the JEE Main page flow for %s", slug => {
    open(slug);
    const ids = ["registration", "registration-form", "question-papers", "guidance-form", "important-dates", "next-steps", "official-resources", "questions"];
    const sections = ids.map(id => document.getElementById(id)!);
    expect(sections.every(Boolean)).toBe(true);
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i - 1].compareDocumentPosition(sections[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(within(sections[0]).getAllByRole("link", { name: /official/i }).length).toBeGreaterThan(0);
    expect(within(sections[0]).getByRole("img", { name: /Screenshot/i })).toBeInTheDocument();
    expect(within(sections[1]).getByRole("form")).toBeInTheDocument();
    expect(within(sections[3]).getByRole("form")).toBeInTheDocument();
    expect(within(sections[2]).getAllByRole("link").length).toBeGreaterThan(0);
  });

  it("uses actual JEE Advanced papers and does not label CLAT papers free", () => {
    open("jee-advanced-2027");
    expect(within(screen.getByRole("region", { name: "JEE Advanced 2027 question papers and practice" })).getByRole("link", { name: /2025 · Paper 1/ })).toHaveAttribute("href", "https://jeeadv.ac.in/past_qps/2025_1_English.pdf");
  });

  it("explains the CLAT previous-paper charge", () => {
    open("clat-2027");
    expect(screen.getByRole("region", { name: "CLAT 2027 question papers and practice" })).toHaveTextContent("₹500");
  });
});
