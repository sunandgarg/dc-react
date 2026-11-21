import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Apply from "./Apply";

vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));

beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() });
  window.scrollTo = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollBy = vi.fn();
});

beforeEach(() => window.history.replaceState(null, "", "/apply"));

describe("university map", () => {
  it("opens a state's official university links on the same page", () => {
    render(<MemoryRouter><Apply /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Explore universities in Kerala" }));

    expect(screen.getByRole("heading", { name: "Kerala" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /University of Kerala, official website/ })).toHaveAttribute("href", "https://www.keralauniversity.ac.in/");
    expect(window.location.pathname).not.toContain("/apply/kerala");
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("highlights the requested states and groups Delhi NCR universities by six", () => {
    render(<MemoryRouter><Apply /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /Only top universities of India, all in one place for you/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore universities in Haryana" })).toHaveAttribute("fill", "#e78046");
    expect(screen.getByRole("button", { name: "Explore universities in Andhra Pradesh" })).not.toHaveAttribute("fill", "#e78046");
    expect(screen.getByRole("region", { name: "Handpicked universities, swipe to see more" }).querySelectorAll("img")).toHaveLength(10);

    const rail = screen.getByRole("region", { name: "Delhi NCR university lists, scroll horizontally" });
    expect(rail.children).toHaveLength(3);
    expect([...rail.children].map((column) => column.querySelectorAll("a").length)).toEqual([6, 6, 6]);
    expect(within(rail).getAllByRole("link").every((link) => link.querySelector("img"))).toBe(true);
    expect(screen.getByRole("link", { name: /University of Delhi, official website/ }).querySelector("img")).toHaveAttribute("src", "/university-logos/directory/delhi-emblem.webp");
    fireEvent.click(screen.getByRole("button", { name: "Sonipat" }));
    expect(within(rail).getAllByRole("link")).toHaveLength(2);
    expect(within(rail).getByRole("link", { name: /Ashoka University, Sonipat/ })).toBeInTheDocument();
  });
});
