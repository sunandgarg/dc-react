import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamLogo } from "./ExamLogo";

describe("ExamLogo", () => {
  it("shows a reviewed official asset instead of an old generated ring", () => {
    render(<ExamLogo exam={{ slug: "pu-cet-ug", short_name: "PU CET", logo: "/exam-logos-v2/pu.webp" }} />);
    expect(screen.getByRole("img", { name: "PU CET logo" })).toHaveAttribute("src", expect.stringContaining("/exam-logos/official-v1/"));
  });
  it("handles image failures and recovers when the source changes", () => {
    const { rerender } = render(<ExamLogo exam={{ name: "Example", logo: "/broken.webp" }} />);
    fireEvent.error(screen.getByRole("img", { name: "Example logo" }));
    expect(screen.queryByRole("img", { name: "Example logo" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Example: logo unavailable")).toBeInTheDocument();
    rerender(<ExamLogo exam={{ name: "Example", logo: "/correct.webp" }} />);
    expect(screen.getByRole("img", { name: "Example logo" })).toHaveAttribute("src", "/correct.webp");
  });
  it("tries the reviewed local mark when a saved image breaks, without an error loop", () => {
    render(<ExamLogo exam={{ slug: "pu-cet-ug", short_name: "PU CET", logo: "/broken-custom.webp" }} />);
    fireEvent.error(screen.getByRole("img", { name: "PU CET logo" }));
    expect(screen.getByRole("img", { name: "PU CET logo" })).toHaveAttribute("src", expect.stringContaining("/exam-logos/official-v1/"));
    fireEvent.error(screen.getByRole("img", { name: "PU CET logo" }));
    expect(screen.queryByRole("img", { name: "PU CET logo" })).not.toBeInTheDocument();
  });
});
