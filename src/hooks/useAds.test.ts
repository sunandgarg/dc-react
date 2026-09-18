import { describe, expect, it } from "vitest";
import { encodeAdLocation, type Ad, selectBestAd, selectMatchingAds } from "./useAds";

function ad(overrides: Partial<Ad>): Ad {
  return {
    id: overrides.id || crypto.randomUUID(),
    title: "Test ad",
    subtitle: null,
    cta_text: "Open",
    link_url: "https://dekhocampus.com",
    image_url: null,
    variant: "horizontal",
    bg_gradient: "from-blue-500 to-indigo-500",
    target_type: "universal",
    target_page: null,
    target_item_slug: null,
    target_city: null,
    target_state: null,
    position: "top",
    priority: 10,
    is_active: true,
    ...overrides,
  };
}

describe("internal ad selection", () => {
  it("does not force an incompatible creative shape into a slot", () => {
    const universal = ad({ id: "universal", variant: "leaderboard", position: "top" });
    expect(selectBestAd([universal], { page: "articles", position: "top", variant: "horizontal" })).toBeNull();
  });

  it("matches any selected city independently of state", () => {
    const cityAd = ad({ id: "cities", target_type: "city", target_city: encodeAdLocation("", ["Mumbai", "Chennai"]) });
    expect(selectBestAd([cityAd], { city: "Chennai", position: "top" })?.id).toBe("cities");
  });

  it("prefers an item ad and does not leak a same-slug ad from another entity type", () => {
    const universal = ad({ id: "universal", position: "mid-page" });
    const article = ad({ id: "article", target_type: "item", target_page: "articles", target_item_slug: "shared-slug", position: "mid-page" });
    const college = ad({ id: "college", target_type: "item", target_page: "colleges", target_item_slug: "shared-slug", position: "mid-page", priority: 99 });
    expect(selectBestAd([universal, college, article], { page: "articles", itemSlug: "shared-slug", position: "mid-page" })?.id).toBe("article");
  });

  it("uses the same Delhi NCR state label as public filters and supports migrated legacy ads", () => {
    const stateAd = ad({ id: "state", target_type: "city", target_city: "Delhi NCR" });
    expect(selectBestAd([stateAd], { state: "Delhi", position: "top" })?.id).toBe("state");
  });

  it("maps a legacy city audience value to its current state", () => {
    const stateAd = ad({ id: "state", target_type: "city", target_city: "Chennai" });
    expect(selectBestAd([stateAd], { state: "Tamil Nadu", position: "top" })?.id).toBe("state");
  });

  it("respects position and active date boundaries", () => {
    const wrongPosition = ad({ id: "wrong", position: "bottom", priority: 100 });
    const expired = ad({ id: "expired", end_date: "2000-01-01T00:00:00.000Z" });
    const valid = ad({ id: "valid" });
    expect(selectBestAd([wrongPosition, expired, valid], { position: "top" })?.id).toBe("valid");
  });

  it("returns every campaign at the best matching level for a carousel", () => {
    const universal = ad({ id: "universal", variant: "announcement", position: "announcement-bar", priority: 100 });
    const first = ad({ id: "first", target_type: "page", target_page: "articles", variant: "announcement", position: "announcement-bar", priority: 20 });
    const second = ad({ id: "second", target_type: "page", target_page: "articles", variant: "announcement", position: "announcement-bar", priority: 10 });
    expect(selectMatchingAds([universal, second, first], {
      page: "articles",
      variant: "announcement",
      position: "announcement-bar",
    }).map((item) => item.id)).toEqual(["first", "second"]);
  });
});
