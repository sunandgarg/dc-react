import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import JeeMainAdPage from "./JeeMainAdPage";
import { useSEO } from "@/hooks/useSEO";

vi.mock("@/hooks/useSEO", () => ({ useSEO: vi.fn() }));
vi.mock("@/components/AuthorByline", () => ({ AuthorByline: () => <p>Written by Geethika Reddy</p> }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => <header><div>Shared announcement bar</div><nav aria-label="Homepage navigation">DekhoCampus navigation</nav></header> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer>Shared DekhoCampus footer</footer> }));
vi.mock("@/components/LeadGateDialog", () => ({ LeadGateDialog: ({ open, onOpenChange, forceShow, subtitle, brandLogoUrl, brandName, source }: { open: boolean; onOpenChange: (open: boolean) => void; forceShow: boolean; subtitle: string; brandLogoUrl: string; brandName: string; source: string }) => open ? <div role="dialog" aria-label="Lead Form" data-source={source} data-force-show={forceShow}><img src={brandLogoUrl} alt={`${brandName} logo`} /><p>{subtitle}</p><button onClick={() => onOpenChange(false)}>Close</button></div> : null }));
vi.mock("@/components/LeadCaptureForm", () => ({ LeadCaptureForm: ({ title, subtitle, source, brandLogoUrl, brandName }: { title: string; subtitle: string; source: string; brandLogoUrl?: string; brandName?: string }) => <div data-source={source}>{brandLogoUrl && <img src={brandLogoUrl} alt={`${brandName} logo`} />}{title}<p>{subtitle}</p></div> }));
vi.mock("@/components/FAQSection", () => ({ FAQSection: ({ title, fallback }: { title: string; fallback: { question: string; answer: string }[] }) => <section aria-label="Dedicated FAQs"><h2>{title}</h2>{fallback.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</section> }));

function open(slug: string) {
  render(<MemoryRouter initialEntries={[`/ad/${slug}`]}><Routes><Route path="/ad/:slug" element={<JeeMainAdPage />} /></Routes></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

describe("JEE Main ad pages", () => {
  it("keeps the English guidance form separate from the official application", () => {
    open("jee-main-2027");
    expect(screen.getByRole("link", { name: "Visit the official NTA JEE Main portal" })).toHaveAttribute("href", "https://jeemain.nta.nic.in/");
    expect(within(screen.getByRole("region", { name: "Official NTA application link" })).getByRole("img", { name: "National Testing Agency logo" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "DekhoCampus JEE Main guidance form" })).getByRole("img", { name: "National Testing Agency logo" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Get free guidance" }).every(link => link.getAttribute("href") === "#jee-guidance-form")).toBe(true);
    expect(screen.getByText("This optional DekhoCampus form is for guidance and updates. It is not an NTA application form.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /NTA notice dated 30 October 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "JEE Main 2027 application questions" })).toBeInTheDocument();
    expect(screen.getByText("Get JEE Main guidance from DekhoCampus").closest("[data-source]")).toHaveAttribute("data-source", "JEE-paid");
    expect(screen.getByRole("heading", { name: "Application fee for one paper at an Indian centre" })).toBeInTheDocument();
    const article = screen.getByRole("article");
    const form = within(article).getByRole("region", { name: "DekhoCampus JEE Main guidance form" });
    const papers = within(article).getByRole("region", { name: "JEE Main question papers: last 5 years" });
    const documents = within(article).getByRole("heading", { name: "Prepare these documents before you start" });
    expect(papers.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(form.compareDocumentPosition(documents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("uses the shared site layout and opens the NTA-branded lead form before the application handoff", () => {
    open("jee-main-2027");
    expect(screen.getByRole("navigation", { name: "Homepage navigation" })).toBeInTheDocument();
    expect(screen.getByText("Shared announcement bar")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Shared DekhoCampus footer");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Open the official form", exact: true })[0]);
    const dialog = screen.getByRole("dialog", { name: "Lead Form" });
    expect(dialog).toHaveAttribute("data-force-show", "true");
    expect(dialog).toHaveAttribute("data-source", "JEE-paid");
    expect(within(dialog).getByRole("img", { name: "National Testing Agency logo" })).toHaveAttribute("src", expect.stringContaining("nta-logo-official-link.png"));
    expect(dialog).toHaveTextContent("Independent guidance from DekhoCampus, not an NTA registration form");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps all five years of official papers free to open without submitting a lead", () => {
    open("jee-main-2027");
    const papers = screen.getByRole("region", { name: "JEE Main question papers: last 5 years" });
    const pdfLinks = within(papers).getAllByRole("link", { name: /question paper PDF$/ });
    expect(pdfLinks).toHaveLength(10);
    for (const year of [2026, 2025, 2024, 2023, 2022]) {
      expect(pdfLinks.filter(link => link.getAttribute("aria-label")?.includes(String(year)))).toHaveLength(2);
    }
    for (const link of pdfLinks) {
      const url = new URL(link.getAttribute("href")!);
      expect(["nta.ac.in", "cdnbbsr.s3waas.gov.in"]).toContain(url.hostname);
      expect(url.pathname.endsWith(".pdf")).toBe(true);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
    expect(within(papers).getByText(/No guidance request is needed/)).toBeInTheDocument();
  });

  it("uses the application alias with the existing canonical and dedicated edited FAQs", () => {
    open("jee-main-2027-application");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("JEE Main 2027 application");
    const seo = vi.mocked(useSEO).mock.lastCall![0];
    expect(seo.canonical).toBe("/ad/jee-main-2027");
    expect(seo.title!.length).toBeLessThanOrEqual(60);
    expect(seo.description!.length).toBeLessThanOrEqual(155);
    expect(seo.robots).toBe("noindex, follow, noarchive");
    expect(within(screen.getByRole("region", { name: "Dedicated FAQs" })).getAllByRole("group")).toHaveLength(6);
    expect(document.body.textContent).not.toMatch(/[\u2013\u2014]/);
  });

  it("renders Hindi copy and stops showing the time-sensitive video after the application window", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-27T00:00:00Z"));
    open("jee-main-2027-hi");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("आवेदन");
    expect(screen.getByText("यह DekhoCampus का वैकल्पिक मार्गदर्शन फॉर्म है, NTA का आवेदन फॉर्म नहीं।")).toBeInTheDocument();
    expect(screen.queryByLabelText("आवेदन के चरण वीडियो में देखें")).not.toBeInTheDocument();
  });
});
