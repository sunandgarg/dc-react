import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollSpy } from "@/components/ScrollSpy";

describe("ScrollSpy", () => {
  let animationFrame: FrameRequestCallback | undefined;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      animationFrame = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  const runRequestedFrame = () => {
    act(() => animationFrame?.(0));
    animationFrame = undefined;
  };

  it("sticks below the full header and scrolls sections clear of both bars", () => {
    const header = document.createElement("header");
    header.id = "site-header";
    header.getBoundingClientRect = () => ({ height: 96 } as DOMRect);
    document.body.append(header);

    const target = document.createElement("section");
    target.id = "cutoff";
    target.getBoundingClientRect = () => ({ top: 500 } as DOMRect);
    document.body.append(target);

    render(
      <MemoryRouter>
        <ScrollSpy sections={[{ id: "overview", label: "Overview" }, { id: "cutoff", label: "Cutoff" }]} />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(nav).toHaveStyle({ top: "96px" });
    expect(nav).toHaveClass("overflow-x-auto");
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "location");

    fireEvent.click(screen.getByRole("button", { name: "Cutoff" }));
    expect(screen.getByRole("button", { name: "Cutoff" })).toHaveAttribute("aria-current", "location");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 340, behavior: "smooth" });
  });

  it("keeps the active tab in sync while scrolling down and back up", () => {
    const header = document.createElement("header");
    header.id = "site-header";
    header.getBoundingClientRect = () => ({ height: 64 } as DOMRect);
    document.body.append(header);

    const positions = { overview: 100, fees: 620, cutoff: 1120 };
    Object.entries(positions).forEach(([id, initialTop]) => {
      const section = document.createElement("section");
      section.id = id;
      section.getBoundingClientRect = () => ({ top: positions[id as keyof typeof positions] } as DOMRect);
      document.body.append(section);
    });

    render(
      <MemoryRouter>
        <ScrollSpy sections={[
          { id: "overview", label: "Overview" },
          { id: "fees", label: "Fees" },
          { id: "cutoff", label: "Cutoff" },
        ]} />
      </MemoryRouter>,
    );

    runRequestedFrame();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "location");

    const nav = screen.getByRole("navigation", { name: "Page sections" });
    Object.defineProperty(nav, "clientWidth", { value: 180 });
    const cutoffButton = screen.getByRole("button", { name: "Cutoff" });
    Object.defineProperty(cutoffButton, "offsetLeft", { value: 260 });
    Object.defineProperty(cutoffButton, "clientWidth", { value: 80 });
    (HTMLElement.prototype.scrollTo as ReturnType<typeof vi.fn>).mockClear();

    positions.overview = -1040;
    positions.fees = -520;
    positions.cutoff = 20;
    fireEvent.scroll(window);
    runRequestedFrame();
    expect(screen.getByRole("button", { name: "Cutoff" })).toHaveAttribute("aria-current", "location");
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({ left: 210, behavior: "smooth" });

    positions.overview = -20;
    positions.fees = 500;
    positions.cutoff = 1000;
    fireEvent.scroll(window);
    runRequestedFrame();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "location");
  });
});
