import { describe, expect, it } from "vitest";
import { normalizePage, paginationItems } from "./pagination";

describe("pagination helpers", () => {
  it("normalizes invalid and out-of-range page values", () => {
    expect(normalizePage(undefined, 8)).toBe(1);
    expect(normalizePage("-3", 8)).toBe(1);
    expect(normalizePage("99", 8)).toBe(8);
    expect(normalizePage("4", 8)).toBe(4);
  });

  it("shows every page when the result set is short", () => {
    expect(paginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the first, current neighbourhood and last page visible", () => {
    expect(paginationItems(6, 12)).toEqual([1, "ellipsis-start", 5, 6, 7, "ellipsis-end", 12]);
  });

  it("expands page numbers cleanly near both ends", () => {
    expect(paginationItems(1, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 12]);
    expect(paginationItems(12, 12)).toEqual([1, "ellipsis-start", 8, 9, 10, 11, 12]);
  });
});
