import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthorAvatar } from "./AuthorAvatar";

describe("writer avatar choices", () => {
  it("hides an existing photo unless Photo is explicitly selected", () => {
    render(<AuthorAvatar name="Neha" photo="https://example.com/neha.jpg" />);
    expect(screen.getByAltText("Woman writer illustration")).toBeInTheDocument();
    expect(screen.queryByAltText("Neha profile photo")).not.toBeInTheDocument();
  });

  it("shows a selected emoji instead of the saved photo", () => {
    render(<AuthorAvatar name="Neha" photo="https://example.com/neha.jpg" avatarStyle="emoji" avatarEmoji="📚" />);
    expect(screen.getByRole("img", { name: "Neha illustrated avatar" })).toHaveTextContent("📚");
    expect(screen.queryByAltText("Neha profile photo")).not.toBeInTheDocument();
  });

  it("shows a valid photo when Photo is selected", () => {
    render(<AuthorAvatar name="Neha" photo="https://example.com/neha.jpg" avatarStyle="photo" />);
    expect(screen.getByAltText("Neha profile photo")).toHaveAttribute("src", "https://example.com/neha.jpg");
  });

  it("falls back to the illustration for an invalid photo URL", () => {
    render(<AuthorAvatar name="Neha" photo="javascript:alert(1)" avatarStyle="photo" />);
    expect(screen.getByAltText("Woman writer illustration")).toBeInTheDocument();
  });

  it("uses the matching illustration for current writers and allows an explicit override", () => {
    const { rerender } = render(<AuthorAvatar name="Aditi Mishra" />);
    expect(screen.getByAltText("Woman writer illustration")).toBeInTheDocument();
    rerender(<AuthorAvatar name="Arjun Singh" />);
    expect(screen.getByAltText("Man writer illustration")).toBeInTheDocument();
    rerender(<AuthorAvatar name="Aditi Mishra" avatarStyle="illustration_m" />);
    expect(screen.getByAltText("Man writer illustration")).toBeInTheDocument();
    rerender(<AuthorAvatar name="Arjun Singh" avatarStyle="illustration_f" />);
    expect(screen.getByAltText("Woman writer illustration")).toBeInTheDocument();
  });
});
