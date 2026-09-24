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

    const surface = container.querySelector('a[aria-label="Open First announcement"]');
    expect(surface).toBeTruthy();
    expect(surface).toHaveAttribute("draggable", "false");
    expect(screen.getByLabelText("Open First announcement")).toBeInTheDocument();

    fireEvent.pointerDown(surface!, { pointerId: 1, pointerType: "touch", clientX: 220, clientY: 20 });
    fireEvent.pointerMove(surface!, { pointerId: 1, pointerType: "touch", clientX: 120, clientY: 23 });
    fireEvent.pointerUp(surface!, { pointerId: 1, pointerType: "touch", clientX: 120, clientY: 23 });
    fireEvent.click(surface!);

    await waitFor(() => expect(screen.getByLabelText("Open Second announcement")).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("swipes from empty space in the full-width bar and still follows a normal click", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AnnouncementBar />
        <LocationProbe />
      </MemoryRouter>,
    );

    const firstLink = container.querySelector('a[aria-label="Open First announcement"]');
    expect(firstLink).toBeTruthy();
    fireEvent.pointerDown(firstLink!, { pointerId: 2, pointerType: "mouse", button: 0, clientX: 600, clientY: 20 });
    fireEvent.pointerMove(firstLink!, { pointerId: 2, pointerType: "mouse", clientX: 480, clientY: 20 });
    fireEvent.pointerUp(firstLink!, { pointerId: 2, pointerType: "mouse", clientX: 480, clientY: 20 });
    fireEvent.click(firstLink!);

    await waitFor(() => expect(screen.getByLabelText("Open Second announcement")).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("opens the announcement on an ordinary click", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AnnouncementBar />
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Open First announcement"));
    expect(screen.getByTestId("location")).toHaveTextContent("/first");
  });

  it("supports native mobile touch swipes in both directions", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AnnouncementBar />
        <LocationProbe />
      </MemoryRouter>,
    );
    const firstLink = container.querySelector('a[aria-label="Open First announcement"]');
    fireEvent.pointerDown(firstLink!, { pointerId: 3, pointerType: "touch", clientX: 220, clientY: 20 });
    fireEvent.touchStart(firstLink!, { touches: [{ clientX: 220, clientY: 20 }] });
    fireEvent.pointerUp(firstLink!, { pointerId: 3, pointerType: "touch", clientX: 100, clientY: 22 });
    fireEvent.touchEnd(firstLink!, { changedTouches: [{ clientX: 100, clientY: 22 }] });
    fireEvent.click(firstLink!);
    await waitFor(() => expect(screen.getByLabelText("Open Second announcement")).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/");
    const secondLink = screen.getByLabelText("Open Second announcement");
    fireEvent.touchStart(secondLink, { touches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchEnd(secondLink, { changedTouches: [{ clientX: 220, clientY: 22 }] });
    await waitFor(() => expect(screen.getByLabelText("Open First announcement")).toBeInTheDocument());
  });
});
