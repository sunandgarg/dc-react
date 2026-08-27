import { describe, expect, it } from "vitest";
import { buildChunkRecoveryUrl, isChunkLoadError } from "./lazyRetry";

describe("chunk load recovery", () => {
  it("recognises deployment-skew import failures", () => {
    expect(isChunkLoadError(new TypeError(
      "Failed to fetch dynamically imported module: https://dekhocampus.com/assets/Page-old.js",
    ))).toBe(true);
    expect(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 42 failed"))).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed"))).toBe(true);
  });

  it("does not misclassify ordinary API failures as stale chunks", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isChunkLoadError(new Error("DekhoCampus API request failed"))).toBe(false);
  });

  it("adds a cache buster while preserving route state", () => {
    const recovered = new URL(buildChunkRecoveryUrl(
      "https://dekhocampus.com/colleges/iit-delhi?tab=courses#fees",
      "build-123",
    ));

    expect(recovered.pathname).toBe("/colleges/iit-delhi");
    expect(recovered.searchParams.get("tab")).toBe("courses");
    expect(recovered.searchParams.get("_r")).toBe("build-123");
    expect(recovered.hash).toBe("#fees");
  });
});
