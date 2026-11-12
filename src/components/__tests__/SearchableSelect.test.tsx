import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchableSelect } from "../SearchableSelect";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([{ top: 350, bottom: 390, above: true, height: 320 }, { top: 20, bottom: 60, above: false, height: 320 }])("keeps options on screen for a button at $top", ({ top, bottom, above, height }) => {
  vi.stubGlobal("visualViewport", { offsetTop: 0, height: 400, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockReturnValue({ top, bottom, left: 20, width: 150 } as DOMRect);
  const onChange = vi.fn();
  render(<SearchableSelect placeholder="State" options={["Haryana", "Punjab"]} value="" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "State" }));
  const menu = document.getElementById("searchable-select-portal-active")!;
  expect(menu.style.transform).toBe(above ? "translateY(-100%)" : "");
  expect(menu.style.maxHeight).toBe(`${height}px`);
  fireEvent.click(screen.getByRole("button", { name: "Haryana" }));
  expect(onChange).toHaveBeenCalledWith("Haryana");
  expect(document.getElementById("searchable-select-portal-active")).toBeNull();
});
