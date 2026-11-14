import { beforeEach, describe, expect, it, vi } from "vitest";

const destination = "AW-17921423601/FnxTCITPl7gdEPHxzOFC";
beforeEach(() => {
  vi.resetModules();
  window.history.replaceState({}, "", "/");
  document.getElementById("dc-ga4-landing-events")?.remove();
  delete (window as any).dcGa4EventsLayer;
  delete (window as any).dcGa4EventsTag;
  (window as any).gtag = vi.fn();
  (window as any).fbq = vi.fn();
  (window as any).dataLayer = [];
});

describe("durable lead conversions", () => {
  it("sends JEE funnel events to GA4 without another page view", async () => {
    window.history.replaceState({}, "", "/ad/jee-main-2027");
    const { configureGa4LandingEvents, trackEvent } = await import("./analytics");
    trackEvent("jee_main_year_open", { year: 2026 });
    configureGa4LandingEvents("G-Y8E5HHTXLX");
    const commands = (window as any).dcGa4EventsLayer.map((entry: IArguments) => Array.from(entry));
    expect(commands).toContainEqual(["config", "G-Y8E5HHTXLX", { send_page_view: false }]);
    expect(commands).toContainEqual(["event", "jee_main_year_open", expect.objectContaining({ year: 2026 })]);
    expect(document.getElementById("dc-ga4-landing-events")).toHaveAttribute("src", "https://www.googletagmanager.com/gtag/js?id=G-Y8E5HHTXLX&l=dcGa4EventsLayer");
  });
  it("uses Google's Arguments queue format when gtag is not loaded yet", async () => {
    delete (window as any).gtag;
    const { configureGoogleAdsConversion, trackLeadConversion } = await import("./analytics");
    configureGoogleAdsConversion("AW-17921423601", "FnxTCITPl7gdEPHxzOFC");
    trackLeadConversion({ transaction_id: "queued-before-load", source: "JEE-paid" });
    const commands = (window as any).dataLayer.filter((entry: unknown) => Object.prototype.toString.call(entry) === "[object Arguments]").map((entry: IArguments) => Array.from(entry));
    expect(commands).toContainEqual(["config", "AW-17921423601"]);
    expect(commands).toContainEqual(["event", "conversion", expect.objectContaining({ send_to: destination, transaction_id: "queued-before-load" })]);
    expect((window as any).dataLayer.some((entry: unknown) => Array.isArray(entry))).toBe(false);
  });
  it("queues a saved lead until the Ads destination is ready and records it once", async () => {
    const { trackLeadConversion, configureGoogleAdsConversion } = await import("./analytics");
    const params = { transaction_id: "saved-lead", source: "JEE-paid" };
    trackLeadConversion(params);
    expect((window as any).gtag).toHaveBeenCalledWith("event", "generate_lead", expect.objectContaining(params));
    expect((window as any).gtag.mock.calls.filter((c: unknown[]) => c[1] === "conversion")).toHaveLength(0);
    configureGoogleAdsConversion("AW-17921423601", "FnxTCITPl7gdEPHxzOFC");
    configureGoogleAdsConversion("AW-17921423601", "FnxTCITPl7gdEPHxzOFC");
    trackLeadConversion(params);
    expect((window as any).gtag.mock.calls.filter((c: unknown[]) => c[1] === "conversion")).toEqual([
      ["event", "conversion", { ...params, value: 1, currency: "INR", send_to: destination }],
    ]);
    expect((window as any).gtag.mock.calls.filter((c: unknown[]) => c[1] === "generate_lead")).toHaveLength(1);
    expect((window as any).fbq.mock.calls.filter((c: unknown[]) => c[0] === "track" && c[1] === "Lead")).toHaveLength(1);
  });

  it("never counts silent intent clicks or events without a saved lead ID", async () => {
    const { trackLeadConversion, configureGoogleAdsConversion } = await import("./analytics");
    configureGoogleAdsConversion("AW-17921423601", "FnxTCITPl7gdEPHxzOFC");
    trackLeadConversion({ transaction_id: "repeat", silent: true });
    trackLeadConversion({ source: "clicked-a-paper" });
    expect((window as any).gtag.mock.calls.filter((c: unknown[]) => c[0] === "event")).toEqual([]);
    expect((window as any).fbq).not.toHaveBeenCalled();
  });

  it("sends the saved ID and source without contact details", async () => {
    const { trackLeadConversion, configureGoogleAdsConversion } = await import("./analytics");
    configureGoogleAdsConversion("AW-17921423601", "FnxTCITPl7gdEPHxzOFC");
    trackLeadConversion({ transaction_id: "saved", source: "JEE-paid", name: "Test Student", email: "student@example.org", phone: "9876543210" });
    const events = (window as any).gtag.mock.calls.filter((c: unknown[]) => c[1] === "conversion" || c[1] === "generate_lead");
    for (const event of events) {
      expect(event[2]).not.toHaveProperty("email");
      expect(event[2]).not.toHaveProperty("phone");
      expect(event[2]).not.toHaveProperty("name");
    }
  });

  it("does not use a malformed conversion destination", async () => {
    const { trackLeadConversion, configureGoogleAdsConversion } = await import("./analytics");
    configureGoogleAdsConversion("invalid", "bad label");
    trackLeadConversion({ transaction_id: "saved" });
    expect((window as any).gtag.mock.calls.filter((c: unknown[]) => c[1] === "conversion")).toHaveLength(0);
  });
});
