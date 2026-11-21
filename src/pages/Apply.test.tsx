import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import Apply from "./Apply";

vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));

beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() });
  window.scrollTo = vi.fn();
});

describe("university map", () => {
  it("opens a state's official university links on the same page", () => {
    render(<MemoryRouter><Apply /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Explore universities in Kerala" }));

    expect(screen.getByRole("heading", { name: "Kerala" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /University of Kerala, official website/ })).toHaveAttribute("href", "https://www.keralauniversity.ac.in/");
    expect(window.location.pathname).not.toContain("/apply/kerala");
    expect(window.scrollTo).toHaveBeenCalled();
  });
});
