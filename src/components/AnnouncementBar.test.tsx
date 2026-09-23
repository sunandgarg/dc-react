import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AnnouncementBar } from "@/components/AnnouncementBar";

const ads = [
  {
    id: "one",
    title: "First announcement",
    subtitle: null,
    cta_text: "Open",
    link_url: "/first",
  },
  {
    id: "two",
    title: "Second announcement",
    subtitle: null,
    cta_text: "Open",
    link_url: "/second",
  },
];

vi.mock("@/hooks/useAds", () => ({
  useMatchingAds: () => ({ data: ads, isLoading: false }),
}));

vi.mock("@/hooks/useSiteIntegration", () => ({
  useSiteIntegration: () => ({ data: "30" }),
}));

beforeAll(() => {
  if (window.PointerEvent) return;
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId || 0;
      this.pointerType = init.pointerType || "mouse";
    }
  }
  Object.defineProperty(window, "PointerEvent", { value: TestPointerEvent });
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

describe("AnnouncementBar", () => {
  it("swipes horizontally without opening the announcement link", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AnnouncementBar />
        <LocationProbe />
      </MemoryRouter>,
    );

    const surface = container.querySelector(".cursor-grab");
    expect(surface).toBeTruthy();
    expect(screen.getByLabelText("First announcement")).toBeInTheDocument();

    fireEvent.pointerDown(surface!, { pointerId: 1, pointerType: "touch", clientX: 220, clientY: 20 });
    fireEvent.pointerMove(surface!, { pointerId: 1, pointerType: "touch", clientX: 120, clientY: 23 });
    fireEvent.pointerUp(surface!, { pointerId: 1, pointerType: "touch", clientX: 120, clientY: 23 });
    fireEvent.click(surface!);

    await waitFor(() => expect(screen.getByLabelText("Second announcement")).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });
});
