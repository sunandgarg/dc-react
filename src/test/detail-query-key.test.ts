import { describe, expect, it } from "vitest";
import { detailEntityQueryKey } from "@/lib/entityUrls";

describe("public detail query identity", () => {
  it.each([
    ["college", "iit-delhi", 10001],
    ["course", "btech-computer-science", 20001],
    ["exam", "jee-main", 30001],
  ] as const)("keeps the %s row mounted while its URL canonicalizes", (entity, slug, shortId) => {
    expect(detailEntityQueryKey(entity, slug)).toEqual(
      detailEntityQueryKey(entity, `${slug}-${shortId}`),
    );
  });

  it("does not share cached rows across distinct slugs", () => {
    expect(detailEntityQueryKey("college", "iit-delhi-10001")).not.toEqual(
      detailEntityQueryKey("college", "iit-bombay-10002"),
    );
  });
});
