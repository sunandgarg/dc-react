import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProgramCard } from "@/components/TrendingPrograms";
import { PremiumDecisionRail } from "@/components/detail/PremiumDecisionRail";

vi.mock("@/hooks/useSiteIntegration", () => ({
  useSiteIntegration: () => ({ data: "" }),
}));

const instituteProgram = {
  title: "Executive Programme in Product Leadership",
  college_name: "IIM Kozhikode",
  slug: "product-leadership-iim-kozhikode",
  hero_image: "https://cdn.example.com/iim-campus.webp",
  image_url: "https://cdn.example.com/old-card.webp",
  institute_logo: "https://cdn.example.com/iim-logo.svg",
  original_price: 120000,
  discount_percent: 10,
  emi_starts_at: 7000,
  duration: "7 Months",
  program_type: "Certificate",
  tag: "IIM",
  youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};

describe("premium IIT/IIM programme presentation", () => {
  it("uses the programme hero as fitted card media and keeps the institute logo", () => {
    render(
      <MemoryRouter>
        <ProgramCard prog={instituteProgram} onLead={vi.fn()} />
      </MemoryRouter>,
    );

    const image = screen.getByRole("img", { name: /Executive Programme.*IIM Kozhikode/i });
    expect(image).toHaveAttribute(
      "src",
      instituteProgram.hero_image,
    );
    expect(image).toHaveClass("object-contain");
    expect(screen.getByRole("img", { name: "IIM Kozhikode logo" })).toHaveAttribute(
      "src",
      instituteProgram.institute_logo,
    );
    expect(screen.getByRole("link", { name: `View ${instituteProgram.title}` })).toHaveAttribute(
      "href",
      `/premium-programs/${instituteProgram.slug}`,
    );
  });

  it("uses the approved campus card image for a mapped IIT programme", () => {
    render(
      <MemoryRouter>
        <ProgramCard
          prog={{
            ...instituteProgram,
            title: "Executive Post Graduate Certificate in Building AI Products",
            college_name: "IIT Kharagpur",
            slug: "executive-post-graduate-certificate-in-building-ai-products-systems-and-services-iit-kharagpur-iit-kharagpur",
          }}
          onLead={vi.fn()}
        />
      </MemoryRouter>,
    );

    const image = screen.getByRole("img", { name: /Building AI Products.*IIT Kharagpur/i });
    expect(image).toHaveAttribute(
      "src",
      "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919914234-ua4doe.webp",
    );
    expect(image).toHaveClass("object-cover");
  });

  it("renders non-IIT programme artwork with an uncropped foreground", () => {
    const program = {
      ...instituteProgram,
      title: "Doctor of Business Administration",
      college_name: "Golden Gate University",
      slug: "doctor-of-business-administration-golden-gate-university",
      tag: "Dr.",
      hero_image: "https://cdn.example.com/portrait-program-art.webp",
    };

    render(
      <MemoryRouter>
        <ProgramCard prog={program} onLead={vi.fn()} />
      </MemoryRouter>,
    );

    const image = screen.getByRole("img", { name: /Doctor of Business Administration.*Golden Gate University/i });
    expect(image).toHaveAttribute("src", program.hero_image);
    expect(image).toHaveClass("object-contain");
  });

  it("uses the compact two-row decision actions for institute programmes", () => {
    render(
      <PremiumDecisionRail
        program={instituteProgram}
        discountedPrice={108000}
        emi={7000}
        formatPrice={(value) => `₹${value}`}
        onApply={vi.fn()}
        onBrochure={vi.fn()}
        onCounsel={vi.fn()}
      />,
    );

    const actions = screen.getByTestId("premium-decision-ctas");
    expect(within(actions).getAllByRole("button").map((button) => button.textContent?.trim())).toEqual([
      "Apply Now",
      "Watch programme video",
      "Brochure",
      "Talk to Counsellor",
    ]);
    expect(within(actions).queryByText(/Overview/i)).not.toBeInTheDocument();
  });

  it("uses the same compact blue-first decision pattern for global programmes", () => {
    render(
      <PremiumDecisionRail
        program={{
          ...instituteProgram,
          title: "Doctor of Business Administration",
          college_name: "Golden Gate University",
          slug: "doctor-of-business-administration-golden-gate-university",
          tag: "Dr.",
        }}
        discountedPrice={1400000}
        emi={0}
        formatPrice={(value) => `₹${value}`}
        onApply={vi.fn()}
        onBrochure={vi.fn()}
        onCounsel={vi.fn()}
      />,
    );

    const actions = screen.getByTestId("premium-decision-ctas");
    expect(within(actions).getAllByRole("button").map((button) => button.textContent?.trim())).toEqual([
      "Apply Now",
      "Watch programme video",
      "Brochure",
      "Talk to Counsellor",
    ]);
    expect(within(actions).queryByText(/Overview/i)).not.toBeInTheDocument();
  });
});
