import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthorPicker } from "./AuthorPicker";

vi.mock("@/integrations/backend/client", () => ({
  backendClient: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [
      { id: "manav", name: "Manav", designation: "Writer" },
      { id: "geethika", name: "Geethika Reddy", designation: "Senior writer" },
      { id: "neha", name: "Neha", designation: "Content writer" },
    ] }) }) }) }),
  },
}));

describe("AuthorPicker", () => {
  it("puts Neha first without reordering other authors or changing the selected byline", async () => {
    const onChange = vi.fn();
    render(<MemoryRouter><AuthorPicker value="geethika" onChange={onChange} /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(4));
    expect(screen.getAllByRole("option").map((option) => (option as HTMLOptionElement).value))
      .toEqual(["", "neha", "manav", "geethika"]);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("geethika");
    expect(onChange).not.toHaveBeenCalled();
  });
});
