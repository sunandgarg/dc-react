import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANNOUNCEMENT_ROTATION_SECONDS,
  circularAnnouncementIndex,
  normalizeAnnouncementRotation,
} from "@/lib/announcementRotation";

describe("announcement rotation", () => {
  it("defaults to 3.5 seconds and preserves supported decimals", () => {
    expect(normalizeAnnouncementRotation(undefined)).toBe(DEFAULT_ANNOUNCEMENT_ROTATION_SECONDS);
    expect(normalizeAnnouncementRotation("3.5")).toBe(3.5);
    expect(normalizeAnnouncementRotation(8.26)).toBe(8.3);
  });

  it("keeps admin values within the supported range", () => {
    expect(normalizeAnnouncementRotation(1)).toBe(3.5);
    expect(normalizeAnnouncementRotation(90)).toBe(60);
  });

  it("moves in either direction and wraps around", () => {
    expect(circularAnnouncementIndex(0, 1, 3)).toBe(1);
    expect(circularAnnouncementIndex(2, 1, 3)).toBe(0);
    expect(circularAnnouncementIndex(0, -1, 3)).toBe(2);
    expect(circularAnnouncementIndex(0, 1, 0)).toBe(0);
  });
});
