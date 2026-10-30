import { beforeEach, describe, expect, it, vi } from "vitest";
import { measurementAllowed, googleConsentCommand } from "./measurementConsent";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("location", new URL("https://dekhocampus.com/news/example"));
  delete (window as any).gtag;
  (window as any).dataLayer = [];
});

describe("measurement consent", () => {
  it("fails closed for no choice, essential only, corrupt or missing preferences", () => {
    expect(measurementAllowed("analytics")).toBe(false);
    localStorage.setItem("dc_cookie_consent_v1", "essential");
    localStorage.setItem("dc_cookie_prefs_v1", '{"analytics":true,"marketing":true}');
    expect(measurementAllowed("analytics")).toBe(false);
    localStorage.setItem("dc_cookie_consent_v1", "accepted");
    localStorage.setItem("dc_cookie_prefs_v1", "broken");
    expect(measurementAllowed("marketing")).toBe(false);
    localStorage.removeItem("dc_cookie_prefs_v1");
    expect(measurementAllowed("analytics")).toBe(false);
  });
  it("honours separate permissions and blocks preview/admin measurement", () => {
    localStorage.setItem("dc_cookie_consent_v1", "accepted");
    localStorage.setItem("dc_cookie_prefs_v1", '{"analytics":true,"marketing":false}');
    expect(measurementAllowed("analytics")).toBe(true);
    expect(measurementAllowed("marketing")).toBe(false);
    vi.stubGlobal("location", new URL("https://dekhocampus.com/admin/articles"));
    expect(measurementAllowed("analytics")).toBe(false);
    vi.stubGlobal("location", new URL("http://127.0.0.1/news/example"));
    expect(measurementAllowed("analytics")).toBe(false);
  });
  it("queues Google consent using the documented Arguments command shape", () => {
    googleConsentCommand("default");
    const command = (window as any).dataLayer[0];
    expect(Array.from(command)).toEqual(["consent", "default", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    }]);
    expect(Array.isArray(command)).toBe(false);
  });
});
