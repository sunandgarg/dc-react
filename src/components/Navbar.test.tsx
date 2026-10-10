import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { Navbar } from "./Navbar";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, isAdmin: false, canAccess: () => false }) }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({}) }));
vi.mock("./AnnouncementBar", () => ({ AnnouncementBar: () => null }));
vi.mock("./GlobalSearchBar", () => ({ GlobalSearchBar: () => null }));
vi.mock("./MegaMenu", () => ({ MegaMenu: () => <span>Desktop categories</span>, MobileMegaMenu: ({ onNavigate }: { onNavigate: () => void }) => <button onClick={onNavigate}>Mobile categories</button> }));
afterEach(() => vi.restoreAllMocks());

it("loads mobile categories on opening and enables desktop categories after resizing", async () => {
  let resize: () => void = () => undefined;
  const media = { matches: false, addEventListener: (_: string, listener: () => void) => { resize = listener; }, removeEventListener: vi.fn() };
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  render(<MemoryRouter><Navbar /></MemoryRouter>);
  expect(screen.queryByText("Mobile categories")).not.toBeInTheDocument();
  expect(screen.queryByText("Desktop categories")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
  fireEvent.click(await screen.findByText("Mobile categories"));
  expect(screen.queryByText("Mobile categories")).not.toBeInTheDocument();
  act(() => { media.matches = true; resize(); });
  expect(await screen.findByText("Desktop categories")).toBeVisible();
});
