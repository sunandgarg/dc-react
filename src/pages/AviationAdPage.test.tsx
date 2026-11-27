import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AviationAdPage from "./AviationAdPage";

const seo = vi.fn();
vi.mock("@/hooks/useSEO", () => ({ useSEO: (value: unknown) => seo(value) }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => <header /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));
vi.mock("@/components/LeadCaptureForm", () => ({ LeadCaptureForm: (props: Record<string, unknown>) => <div data-testid="aviation-lead-form" data-source={props.source} data-course={props.fixedCourse} data-location={String(props.requireLocation)} /> }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

describe("aviation ad page", () => {
  beforeEach(() => seo.mockClear());

  it("shows the supplied creative, course guidance and an attributed two-step lead form", () => {
    render(<MemoryRouter><AviationAdPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Aviation careers after Class 12" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /DekhoCampus aviation careers creative/ })).toHaveAttribute("src", "/assets/aviation-careers-after-12.webp");
    expect(screen.getAllByTestId("aviation-lead-form")).toHaveLength(2);
    screen.getAllByTestId("aviation-lead-form").forEach((form) => {
      expect(form).toHaveAttribute("data-source", "aviation_paid");
      expect(form).toHaveAttribute("data-course", "Aviation");
      expect(form).toHaveAttribute("data-location", "true");
    });
    expect(screen.getByRole("link", { name: /Browse aviation courses/ })).toHaveAttribute("href", "/courses?stream=Aviation");
    expect(seo).toHaveBeenCalledWith(expect.objectContaining({ canonical: "/ad/aviation-after-12", robots: "noindex, follow, noarchive" }));
  });
});
