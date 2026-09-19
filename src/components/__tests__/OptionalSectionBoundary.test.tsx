import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptionalSectionBoundary } from "@/components/OptionalSectionBoundary";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

function BrokenSection() {
  throw new Error("stale chunk");
}

describe("OptionalSectionBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the page mounted when an optional section fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(
      <OptionalSectionBoundary name="test-section" minHeight={240}>
        <BrokenSection />
      </OptionalSectionBoundary>,
    );

    expect(container.firstElementChild).toHaveStyle({ minHeight: "240px" });
  });
});
