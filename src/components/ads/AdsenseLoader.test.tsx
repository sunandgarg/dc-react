import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AdsenseLoader } from "./AdsenseLoader";

vi.mock("@/hooks/useAdsense", () => ({
  useAdsenseSettings: () => ({ data: { ads_globally_enabled: true, auto_ads_enabled: true, client_id: "ca-pub-test" } }),
  useAdScripts: () => ({ data: [] }),
}));

afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll(".google-auto-placed, #adsbygoogle-lib").forEach(element => element.remove());
});

it("does not inject AdSense on the JEE landing page even when ads are enabled", () => {
  vi.useFakeTimers();
  render(<MemoryRouter initialEntries={["/ad/jee-main-2027"]}><AdsenseLoader /></MemoryRouter>);
  vi.runAllTimers();
  expect(document.getElementById("adsbygoogle-lib")).toBeNull();
  expect(document.getElementById("adsbygoogle-autoads")).toBeNull();
});

it("removes existing and late-arriving Google spaces after navigating to the JEE page", async () => {
  function VisitJee() {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/ad/jee-main-2027")}>Visit JEE</button>;
  }
  render(<MemoryRouter initialEntries={["/news"]}><AdsenseLoader /><VisitJee /></MemoryRouter>);
  const existing = document.createElement("div");
  existing.className = "google-auto-placed";
  document.body.appendChild(existing);
  fireEvent.click(screen.getByRole("button", { name: "Visit JEE" }));
  expect(existing).not.toBeInTheDocument();
  const lateAd = document.createElement("div");
  lateAd.className = "google-auto-placed";
  document.body.appendChild(lateAd);
  await waitFor(() => expect(lateAd).not.toBeInTheDocument());
});
