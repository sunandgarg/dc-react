import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchResultIcon } from "@/components/SearchResultIcon";
import { resolveDirectoryMediaUrl } from "@/lib/directorySearch";

describe("SearchResultIcon", () => {
  it("renders a supplied directory logo", () => {
    render(<SearchResultIcon type="College" imageUrl="https://cdn.example.com/amity.webp" alt="Amity logo" />);

    expect(screen.getByRole("img", { name: "Amity logo" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/amity.webp",
    );
  });

  it("replaces a failed image without showing a broken-image element", () => {
    const { container } = render(
      <SearchResultIcon type="College" imageUrl="https://cdn.example.com/missing.webp" alt="Missing logo" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Missing logo" }));

    expect(screen.queryByRole("img", { name: "Missing logo" })).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("expands AWS storage keys returned by directory search", () => {
    const resolved = resolveDirectoryMediaUrl("legacy-public-assets/college-logos/amity.webp");

    expect(resolved).toContain("/storage/v1/object/public/legacy-public-assets/college-logos/amity.webp");
    expect(resolveDirectoryMediaUrl("https://cdn.example.com/amity.webp")).toBe("https://cdn.example.com/amity.webp");
  });

  it("uses the official CSEET mark instead of the legacy ring", () => {
    render(<SearchResultIcon type="Exam" slug="cseet-icsi" imageUrl="/exam-logos-v2/cseet-icsi.webp" alt="CSEET logo" />);
    expect(screen.getByRole("img", { name: "CSEET logo" })).toHaveAttribute("src", "/exam-logos/official-v1/115cec1b7e0e6a7c0cb8c513.webp");
  });

  it("falls back to a reviewed exam mark when a custom logo fails", () => {
    render(<SearchResultIcon type="Exam" slug="cseet-icsi" imageUrl="https://example.com/broken.webp" alt="CSEET logo" />);
    fireEvent.error(screen.getByRole("img", { name: "CSEET logo" }));
    expect(screen.getByRole("img", { name: "CSEET logo" })).toHaveAttribute("src", "/exam-logos/official-v1/115cec1b7e0e6a7c0cb8c513.webp");
  });
});
