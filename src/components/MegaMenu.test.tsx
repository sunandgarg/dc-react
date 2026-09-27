import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MegaMenu, MobileMegaMenu } from "@/components/MegaMenu";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { colleges: [], courses: [], exams: [] } }),
}));
vi.mock("@/hooks/useAds", () => ({ useAds: () => ({ data: null }) }));

beforeEach(() => vi.stubGlobal("innerWidth", 1440));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function openSection(name: string) {
  render(<MemoryRouter><MegaMenu /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
}

describe("MegaMenu listing filters", () => {
  it("uses the exam stream and supported exam levels", () => {
    openSection("Exams");
    expect(screen.getByRole("link", { name: /Engineering/ })).toHaveAttribute("href", "/exams?stream=Engineering");
    fireEvent.click(screen.getByRole("tab", { name: "By Level" }));
    expect(screen.getByRole("link", { name: /Undergraduate/ })).toHaveAttribute("href", "/exams?level=UG");
    expect(screen.getByRole("link", { name: /After Class 10/ })).toHaveAttribute("href", "/exams?level=10th");
    fireEvent.click(screen.getByRole("tab", { name: "Exam Categories" }));
    expect(screen.getByRole("link", { name: "Entrance" })).toHaveAttribute("href", "/exams?category=Entrance");
  });

  it("uses course levels supported by the live catalog", () => {
    openSection("Courses");
    fireEvent.click(screen.getByRole("tab", { name: "By Level" }));
    expect(screen.getByRole("link", { name: /Certificate/ })).toHaveAttribute("href", "/courses?level=Certificate");
    expect(screen.getByRole("link", { name: /Doctorate/ })).toHaveAttribute("href", "/courses?level=Doctoral");
  });

  it("uses live scholarship categories and study-board slugs", () => {
    openSection("Scholarships");
    expect(screen.getByRole("link", { name: /Corporate/ })).toHaveAttribute("href", "/scholarships?category=Corporate");
  });

  it("uses a real Bihar Board destination instead of a missing board", () => {
    openSection("More");
    fireEvent.click(screen.getByRole("tab", { name: "Study Material" }));
    expect(screen.getByRole("link", { name: /Bihar Board/ })).toHaveAttribute("href", "/study-material?board=bihar-board");
  });

  it("opens with the keyboard, switches categories and restores focus on Escape", () => {
    render(<MemoryRouter><MegaMenu /></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const first = screen.getByRole("tab", { name: "CAT Universe" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(screen.getByRole("tab", { name: "Study Material" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "More navigation" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps the requested header order and all feature groups available on mobile", () => {
    render(<MemoryRouter><MobileMegaMenu onNavigate={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "About Us" })).toHaveAttribute("href", "/about-us");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByText("CAT Universe")).toBeInTheDocument();
    expect(screen.getByText("Student Tools")).toBeInTheDocument();
    expect(screen.getByText("Guidance & Careers")).toBeInTheDocument();
  });

  it("switches menus without toggling the surface closed and closes at the mobile breakpoint", () => {
    openSection("Colleges");
    fireEvent.click(screen.getByRole("button", { name: "Exams" }));
    expect(screen.getByRole("region", { name: "Exams navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Colleges navigation" })).not.toBeInTheDocument();
    vi.stubGlobal("innerWidth", 390);
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "Exams" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Exams navigation" })).not.toBeInTheDocument();
  });

  it("keeps a hover-open menu open on the first click and cancels pending hover on Escape", () => {
    vi.useFakeTimers();
    render(<MemoryRouter><MegaMenu /></MemoryRouter>);
    const colleges = screen.getByRole("button", { name: "Colleges" });
    const enter = (element: HTMLElement) => {
      const event = new MouseEvent("pointerover", { bubbles: true });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
      fireEvent(element, event);
    };
    enter(colleges);
    act(() => vi.advanceTimersByTime(150));
    expect(colleges).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(colleges);
    expect(colleges).toHaveAttribute("aria-expanded", "true");
    enter(screen.getByRole("button", { name: "Exams" }));
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole("region", { name: /navigation/ })).not.toBeInTheDocument();
  });
});
