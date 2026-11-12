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
vi.mock("@/components/LeadGateDialog", () => ({ LeadGateDialog: ({ open, onOpenChange, forceShow, subtitle, brandLogoUrl, brandName, source, otpDownload, onSuccess }: { otpDownload?: string; onSuccess: (id?: string, url?: string) => void; open: boolean; onOpenChange: (open: boolean) => void; forceShow: boolean; subtitle: string; brandLogoUrl: string; brandName: string; source: string }) => open ? <div role="dialog" aria-label="Lead Form" data-source={source} data-otp-download={otpDownload} data-force-show={forceShow}><img src={brandLogoUrl} alt={`${brandName} logo`} /><p>{subtitle}</p><button onClick={() => onOpenChange(false)}>Close</button><button onClick={() => onSuccess("saved", otpDownload ? "https://downloads.example/verified.zip" : undefined)}>Complete request</button></div> : null }));
vi.mock("@/components/LeadCaptureForm", () => ({ LeadCaptureForm: ({ title, subtitle, source, brandLogoUrl, brandName }: { title: string; subtitle: string; source: string; brandLogoUrl?: string; brandName?: string }) => <div data-source={source}>{brandLogoUrl && <img src={brandLogoUrl} alt={`${brandName} logo`} />}{title}<p>{subtitle}</p></div> }));
vi.mock("@/components/FAQSection", () => ({ FAQSection: ({ title, fallback }: { title: string; fallback: { question: string; answer: string }[] }) => <section aria-label="Dedicated FAQs"><h2>{title}</h2>{fallback.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</section> }));

function open(slug: string) {
  render(<><ArticleLeadLinks siteWide articleSlug="site" /><MemoryRouter initialEntries={[`/ad/${slug}`]}><Routes><Route path="/ad/:slug" element={<JeeMainAdPage />} /></Routes></MemoryRouter></>);
}

afterEach(() => vi.restoreAllMocks());

describe("JEE Main ad pages", () => {
  it("puts the live registration notice, deadline and guidance CTA above the first form", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-13T06:00:00Z"));
    open("jee-main-2027");
    const notice = screen.getByRole("region", { name: "JEE Main registration update" });
    expect(notice).toHaveTextContent("JEE Main 2027 registration is now LIVE!");
    expect(within(notice).getByRole("img", { name: "National Testing Agency", exact: true })).toHaveAttribute("src", "/assets/nta-registration-symbol.png");
    expect(notice).toHaveTextContent("Last date without late fee: 22 November 2026, 11:50 PM IST");
    expect(notice.querySelector("time")).toHaveAttribute("dateTime", "2026-11-22T23:50:00+05:30");
    expect(notice.compareDocumentPosition(screen.getAllByRole("region", { name: "JEE Main guidance form" })[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const apply = within(notice).getByRole("link", { name: "Apply online at jeemain.nta.nic.in" });
    expect(apply).toHaveAttribute("href", "https://jeemain.nta.nic.in/online-application-form-for-jee-main-2027-session-1/");
    expect(apply).toHaveAttribute("target", "_blank");
    expect(apply).toHaveClass("bg-orange-700");
    expect(fireEvent.click(apply)).toBe(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(within(notice).queryByText("Source: NTA Session 1 application notice")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(notice).not.toHaveTextContent("Complete the optional guidance form to continue to NTA");
    expect(notice.closest('[lang="en"]')).not.toHaveClass("[--primary:24_94%_40%]");
    expect(screen.queryByRole("region", { name: "Share this page" })).not.toBeInTheDocument();
  });

  it.each([
    ["2026-11-22T18:21:00Z", "JEE Main 2027 regular registration has closed.", "Check official NTA application updates"],
    ["2026-11-23T06:00:00Z", "JEE Main 2027 late-fee registration is open.", "Apply online at jeemain.nta.nic.in"],
    ["2026-11-26T18:21:00Z", "JEE Main 2027 regular registration has closed.", "Check official NTA application updates"],
  ])("shows the correct registration phase at %s", (time, status, action) => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(time));
    open("jee-main-2027");
    const notice = screen.getByRole("region", { name: "JEE Main registration update" });
    expect(notice).toHaveTextContent(status);
    expect(notice).not.toHaveTextContent("now LIVE!");
    expect(notice).toHaveTextContent("26 November 2026, 11:50 PM IST");
    expect(within(notice).getByRole("link", { name: action })).toBeInTheDocument();
    if (Date.now() > Date.parse("2026-11-26T18:20:00Z")) expect(notice).toHaveTextContent("application window ended");
    else expect(notice).toHaveTextContent("additional fee of ₹500");
  });

  it("preserves two forms after registration and papers, with only linked college logos above the lower form", () => {
    open("jee-main-2027");
    const forms = screen.getAllByRole("region", { name: "JEE Main guidance form" });
    expect(forms).toHaveLength(2);
    expect(forms[0]).toHaveAttribute("id", "jee-registration-form");
    expect(forms[1]).toHaveAttribute("id", "jee-guidance-form");
    const registration = screen.getByRole("heading", { name: "JEE Main 2027 registration: Session 1" });
    const papers = screen.getByRole("region", { name: "JEE Main question papers: last 5 years" });
    const carousel = screen.getByRole("region", { name: "Apply directly. Explore up to 100% scholarships." });
    const portalImage = screen.getByRole("img", { name: /official portal showing new registration/ });
    expect(portalImage).toHaveAttribute("src", "/assets/jee-main-2027-registration-portal.png");
    const ordered = [registration, portalImage, forms[0], papers, carousel, forms[1]];
    ordered.slice(1).forEach((element, i) => expect(ordered[i].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
    expect(screen.queryByText(/Session 1 applications are submitted online through NTA/)).not.toBeInTheDocument();
    expect(screen.queryByText("Get JEE Main guidance from DekhoCampus")).not.toBeInTheDocument();
    for (const form of forms) {
      expect(form).toHaveTextContent("Optional DekhoCampus guidance form");
      expect(within(form).getByRole("img", { name: "National Testing Agency logo" })).toBeInTheDocument();
      expect(form).not.toHaveTextContent("Enter your details for JEE Main guidance");
      expect(form).not.toHaveTextContent("Complete your exam application separately on the official NTA portal.");
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
    expect(screen.queryByText("Get JEE Main guidance and updates")).not.toBeInTheDocument();
    expect(screen.queryByText(/Questions about the process/)).not.toBeInTheDocument();
    expect(forms[0]).not.toHaveTextContent("Independent guidance only.");
  });

  it("opens the guidance form for other external resources and preserves the selected destination", () => {
    open("jee-main-2027");
    const external = screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("https://") && !link.hasAttribute("data-paper-download") && !link.hasAttribute("data-official-resource") && !link.closest('[aria-label="Share this page"]'));
    expect(external.length).toBeGreaterThan(10);
    for (const link of external) {
      expect(fireEvent.click(link)).toBe(false);
      const dialog = screen.getByRole("dialog", { name: "Lead Form" });
      expect(dialog).toHaveAttribute("data-force-show", "true");
      expect(dialog).toHaveAttribute("data-source", "JEE-paid");
      expect(dialog).not.toHaveTextContent("Independent admission guidance");
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

  it("offers the 106-paper ZIP before the 2026 group and downloads it only after the form succeeds", () => {
    open("jee-main-2027");
    const section = within(screen.getByRole("region", { name: "JEE Main question papers: last 5 years" }));
    const download = section.getByRole("button", { name: "Download all 106 papers (.zip)" });
    expect(download.compareDocumentPosition(section.getByRole("button", { name: "2026 19 papers" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const assign = vi.fn();
    const testWindow = Object.create(window);
    Object.defineProperty(testWindow, "location", { value: { origin: window.location.origin, assign } });
    vi.stubGlobal("window", testWindow);
    try {
      fireEvent.click(download);
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
      expect(assign).not.toHaveBeenCalled();
      fireEvent.click(download);
      expect(screen.getByRole("dialog")).toHaveAttribute("data-otp-download", "jee-main-106-papers");
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Complete request" }));
      expect(assign).toHaveBeenCalledExactlyOnceWith("https://downloads.example/verified.zip");
    } finally { vi.unstubAllGlobals(); }
  });

  it("starts with collapsed year cards and opens only the selected download list", () => {
    open("jee-main-2027");
    const section = screen.getByRole("region", { name: "JEE Main question papers: last 5 years" });
    const year = within(section).getByRole("button", { name: "2026 19 papers" });
    expect(year).toHaveAttribute("aria-expanded", "false");
    expect(section.querySelectorAll('div[id^="papers-"]:not([hidden])')).toHaveLength(0);
    fireEvent.click(year);
    expect(year).toHaveAttribute("aria-expanded", "true");
    expect(within(section).getAllByRole("link", { name: /question paper PDF$/ })).toHaveLength(19);
    fireEvent.click(within(section).getByRole("button", { name: "2023 24 papers" }));
    expect(year).toHaveAttribute("aria-expanded", "false");
    expect(within(section).getAllByRole("link", { name: /question paper PDF$/ })).toHaveLength(24);
    fireEvent.click(within(section).getByRole("button", { name: "2023 24 papers" }));
    expect(section.querySelectorAll('div[id^="papers-"]:not([hidden])')).toHaveLength(0);
  });

  it("keeps both shifts for all five years and supports middle-click gating", () => {
    open("jee-main-2027");
    const papers = screen.getByRole("region", { name: "JEE Main question papers: last 5 years" });
    const pdfLinks = within(papers).getAllByRole("link", { name: /question paper PDF$/, hidden: true });
    expect(pdfLinks).toHaveLength(106);
    for (const [year, count] of [[2026, 19], [2025, 19], [2024, 20], [2023, 24], [2022, 24]]) expect(pdfLinks.filter(link => link.getAttribute("aria-label")?.includes(String(year)))).toHaveLength(count);
    for (const link of pdfLinks) {
      const url = new URL(link.getAttribute("href")!);
      expect(url.hostname).toBe("aws-origin.dekhocampus.com");
      expect(url.pathname.endsWith(".pdf")).toBe(true);
    }
    for (const link of pdfLinks) expect(link).toHaveAttribute("data-paper-download");
    expect(fireEvent(pdfLinks[0], new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }))).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
