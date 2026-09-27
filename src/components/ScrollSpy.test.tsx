import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollSpy } from "@/components/ScrollSpy";

describe("ScrollSpy", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("scrollTo", vi.fn());
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

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
});
