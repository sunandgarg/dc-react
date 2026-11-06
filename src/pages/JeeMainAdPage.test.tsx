import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleLeadLinks } from "@/components/ArticleLeadLinks";
import JeeMainAdPage from "./JeeMainAdPage";
import { useSEO } from "@/hooks/useSEO";

vi.mock("@/hooks/useSEO", () => ({ useSEO: vi.fn() }));
vi.mock("@/components/AuthorByline", () => ({ AuthorByline: () => <p>Written by Geethika Reddy</p> }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => <header><div>Shared announcement bar</div><nav aria-label="Homepage navigation">DekhoCampus navigation</nav></header> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer>Shared DekhoCampus footer</footer> }));
vi.mock("@/components/LeadGateDialog", () => ({ LeadGateDialog: ({ open, onOpenChange, forceShow, subtitle, brandLogoUrl, brandName, source, onSuccess }: { onSuccess: () => void; open: boolean; onOpenChange: (open: boolean) => void; forceShow: boolean; subtitle: string; brandLogoUrl: string; brandName: string; source: string }) => open ? <div role="dialog" aria-label="Lead Form" data-source={source} data-force-show={forceShow}><img src={brandLogoUrl} alt={`${brandName} logo`} /><p>{subtitle}</p><button onClick={() => onOpenChange(false)}>Close</button><button onClick={onSuccess}>Complete request</button></div> : null }));
vi.mock("@/components/LeadCaptureForm", () => ({ LeadCaptureForm: ({ title, subtitle, source, brandLogoUrl, brandName }: { title: string; subtitle: string; source: string; brandLogoUrl?: string; brandName?: string }) => <div data-source={source}>{brandLogoUrl && <img src={brandLogoUrl} alt={`${brandName} logo`} />}{title}<p>{subtitle}</p></div> }));
vi.mock("@/components/FAQSection", () => ({ FAQSection: ({ title, fallback }: { title: string; fallback: { question: string; answer: string }[] }) => <section aria-label="Dedicated FAQs"><h2>{title}</h2>{fallback.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</section> }));

function open(slug: string) {
  render(<><ArticleLeadLinks siteWide articleSlug="site" /><MemoryRouter initialEntries={[`/ad/${slug}`]}><Routes><Route path="/ad/:slug" element={<JeeMainAdPage />} /></Routes></MemoryRouter></>);
}

afterEach(() => vi.restoreAllMocks());

describe("JEE Main ad pages", () => {
  it("preserves two forms after registration and papers, with only linked college logos above the lower form", () => {
    open("jee-main-2027");
    const forms = screen.getAllByRole("region", { name: "JEE Main guidance form" });
    expect(forms).toHaveLength(2);
    expect(forms[0]).toHaveAttribute("id", "jee-registration-form");
    expect(forms[1]).toHaveAttribute("id", "jee-guidance-form");
    const registration = screen.getByRole("heading", { name: "JEE Main 2027 registration: Session 1" });
    const papers = screen.getByRole("region", { name: "JEE Main question papers: last 5 years" });
    const carousel = screen.getByRole("region", { name: "Apply directly. Explore up to 100% scholarships." });
    const ordered = [registration, forms[0], papers, carousel, forms[1]];
    ordered.slice(1).forEach((element, i) => expect(ordered[i].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
    expect(screen.queryByText(/Session 1 applications are submitted online through NTA/)).not.toBeInTheDocument();
    expect(screen.queryByText("Get JEE Main guidance from DekhoCampus")).not.toBeInTheDocument();
    for (const form of forms) {
      expect(form).not.toHaveTextContent("DekhoCampus");
      expect(within(form).getByRole("img", { name: "National Testing Agency logo" })).toBeInTheDocument();
      expect(form).toHaveTextContent("Complete your exam application separately on the official NTA portal.");
    }
    const logos = carousel.querySelector('[aria-label="College logos"]')!;
    expect(within(logos as HTMLElement).getAllByRole("link")).toHaveLength(2);
    expect(logos.textContent).toBe("");
    expect(within(logos as HTMLElement).getByRole("link", { name: "Explore Lovely Professional University" })).toHaveAttribute("href", "https://www.lpu.in/landing-pages/brand/?utm_source=dekhocampus");
    expect(within(logos as HTMLElement).getByRole("link", { name: "Explore Amity University" })).toHaveAttribute("href", "https://noida.amity.edu/admission-open/?utm_source=dekhocampus&utm_medium=jee&utm_campaign=jeep");
    expect(within(logos as HTMLElement).queryByRole("link", { name: "Explore Chandigarh University" })).not.toBeInTheDocument();
    expect(within(logos as HTMLElement).getAllByRole("img")).toHaveLength(2);
    expect(carousel).not.toHaveTextContent("Hidden college");
    expect(carousel).toHaveTextContent("early application does not guarantee an award");
    expect(within(screen.getByRole("region", { name: "Official NTA application link" })).getByRole("img", { name: "National Testing Agency logo" })).toBeInTheDocument();
  });

  it("opens the guidance form for every external resource and preserves the selected destination", () => {
    open("jee-main-2027");
    const external = screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("https://"));
    expect(external.length).toBeGreaterThan(15);
    for (const link of external) {
      expect(fireEvent.click(link)).toBe(false);
      const dialog = screen.getByRole("dialog", { name: "Lead Form" });
      expect(dialog).toHaveAttribute("data-force-show", "true");
      expect(dialog).toHaveAttribute("data-source", "JEE-paid");
      expect(dialog).toHaveTextContent("not an NTA application");
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    }
    const college = screen.getByRole("link", { name: "Explore Amity University" });
    expect(fireEvent.click(college)).toBe(false);
    const assign = vi.fn();
    const originalWindow = window;
    const testWindow = Object.create(window);
    Object.defineProperty(testWindow, "location", { value: { origin: window.location.origin, assign } });
    vi.stubGlobal("window", testWindow);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Complete request" }));
      expect(assign).toHaveBeenCalledWith(new URL(college.getAttribute("href")!, window.location.origin).href);
    } finally { vi.stubGlobal("window", originalWindow); }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("link", { name: "Get free guidance" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Open the official form", exact: true })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps both shifts for all five years and supports middle-click gating", () => {
    open("jee-main-2027");
    const papers = screen.getByRole("region", { name: "JEE Main question papers: last 5 years" });
    const pdfLinks = within(papers).getAllByRole("link", { name: /question paper PDF$/ });
    expect(pdfLinks).toHaveLength(10);
    for (const year of [2026, 2025, 2024, 2023, 2022]) expect(pdfLinks.filter(link => link.getAttribute("aria-label")?.includes(String(year)))).toHaveLength(2);
    for (const link of pdfLinks) {
      const url = new URL(link.getAttribute("href")!);
      expect(["nta.ac.in", "cdnbbsr.s3waas.gov.in"]).toContain(url.hostname);
      expect(url.pathname.endsWith(".pdf")).toBe(true);
    }
    fireEvent(pdfLinks[0], new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
