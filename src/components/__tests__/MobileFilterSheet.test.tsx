import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";

const filters = [
  {
    title: "Streams",
    items: ["Engineering", "Management"],
    selected: [],
    onChange: vi.fn(),
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MobileFilterSheet", () => {
  it("does not mount a second filter trigger", () => {
    render(
      <MobileFilterSheet
        filters={filters}
        activeCount={0}
        onClearAll={vi.fn()}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /^filters/i })).not.toBeInTheDocument();
  });

  it("closes an open mobile sheet at the desktop breakpoint", async () => {
    const onOpenChange = vi.fn();
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(min-width: 1024px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    render(
      <MobileFilterSheet
        filters={filters}
        activeCount={0}
        onClearAll={vi.fn()}
        open
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
