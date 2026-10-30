import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { UserTrackingProvider } from "./useUserTracking";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { from: () => ({
  insert: () => Promise.resolve({}), upsert: () => Promise.resolve({}),
}) } }));
function Routes() {
  const navigate = useNavigate();
  return <><UserTrackingProvider>{null}</UserTrackingProvider><button onClick={() => navigate('/news/second')}>Next</button></>;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("location", new URL("https://dekhocampus.com/news/first"));
  localStorage.clear();
  (window as any).dataLayer = [];
  (window as any).gtag = vi.fn();
  (window as any).dcMeasurementReady = true;
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function accept() {
  localStorage.setItem("dc_cookie_consent_v1", "accepted");
  localStorage.setItem("dc_cookie_prefs_v1", '{"analytics":true,"marketing":true}');
}
describe("GA4 SPA measurement", () => {
  it("leaves initial view to GTM and sends one view for a client navigation", () => {
    accept();
    render(<MemoryRouter initialEntries={['/news/first']}><Routes /></MemoryRouter>);
    expect((window as any).gtag).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Next'));
    expect((window as any).gtag).toHaveBeenCalledTimes(1);
    expect((window as any).gtag).toHaveBeenCalledWith('event','page_view',expect.objectContaining({page_path:'/news/second',page_referrer:'https://dekhocampus.com/news/first'}));
  });
  it("does not queue rejected visits or create a tracking session before consent", () => {
    render(<MemoryRouter initialEntries={['/news/first']}><Routes /></MemoryRouter>);
    fireEvent.click(screen.getByText('Next'));
    expect((window as any).gtag).not.toHaveBeenCalled();
    expect(localStorage.getItem('dc_session_id')).toBeNull();
    act(() => { accept(); window.dispatchEvent(new Event('dc:cookie-consent-resolved')); });
    expect((window as any).gtag).not.toHaveBeenCalled();
  });
  it("does not replay routes visited before a blocked or late GTM library loads", () => {
    accept(); (window as any).dcMeasurementReady = false;
    render(<MemoryRouter initialEntries={['/news/first']}><Routes /></MemoryRouter>);
    fireEvent.click(screen.getByText('Next'));
    expect((window as any).gtag).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event('dc:measurement-ready')));
    expect((window as any).gtag).not.toHaveBeenCalled();
  });
});
