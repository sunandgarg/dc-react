import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { GoogleAd } from "./GoogleAd";
const state = vi.hoisted(() => ({ allowed: false, insert: vi.fn(() => Promise.resolve({})), push: vi.fn() }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { from: () => ({ insert: state.insert }) } }));
vi.mock("@/hooks/useAdsense", () => ({
  useAdsAllowed: () => state.allowed,
  useAdsenseSettings: () => ({ data: { client_id: 'test-only-client', lazy_load_enabled: false } }),
  useAdUnits: () => ({ data: [] }),
  pickAdUnit: () => ({ id: 'test-unit', ad_slot_id: 'test-only-slot' }),
}));
beforeEach(() => { state.allowed = false; state.insert.mockClear(); state.push.mockReset(); (window as any).adsbygoogle = {push: state.push}; window.matchMedia = vi.fn().mockReturnValue({matches:false}); });
afterEach(cleanup);
it("does not request or count an ad when permission is denied", () => {
  render(<MemoryRouter initialEntries={['/news/example']}><GoogleAd placement="article" /></MemoryRouter>);
  expect(state.push).not.toHaveBeenCalled(); expect(state.insert).not.toHaveBeenCalled();
});
it("records a failed/blocked attempt as an attempt, never as a Google impression", () => {
  state.allowed = true; state.push.mockImplementation(() => { throw new Error('blocked'); });
  const view = <MemoryRouter initialEntries={['/news/example']}><GoogleAd placement="article" /></MemoryRouter>;
  const {rerender} = render(view); rerender(view);
  expect(state.push).toHaveBeenCalledTimes(1);
  expect(state.insert).toHaveBeenCalledTimes(1);
  expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({event_type:'ad_attempt'}));
});
