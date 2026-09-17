import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCurrentCarouselCutoverManifestRow,
  buildGalleryReplacement,
  buildCarouselCutoverManifestRow,
  buildSanitizedCollegeManifestRow,
  buildProductionIndexes,
  bottomCropPlan,
  canonicalIdentity,
  detectRasterImage,
  findStrictProductionMatch,
  originalMediaKey,
  publicMediaUrl,
  sanitizedOriginalMediaKey,
  sha256,
  stableJson,
} from "../src/original-media-migration.mjs";

test("strict media mapping requires matching identity, not a legacy numeric id", () => {
  const production = [{ id: "uuid-1", slug: "lovely-professional-university", name: "Lovely Professional University", city: "Jalandhar", state: "Punjab" }];
  const indexes = buildProductionIndexes(production);
  assert.equal(findStrictProductionMatch({ slug: "lovely-professional-university", name: "Lovely Professional University", city: "Jalandhar", state: "Punjab" }, indexes).row.id, "uuid-1");
  assert.equal(findStrictProductionMatch({ slug: "lovely-professional-university", name: "IIT Delhi", city: "Delhi", state: "Delhi" }, indexes).row, null);
});

test("normalizes HTML and punctuation while preserving strict identity semantics", () => {
  assert.equal(canonicalIdentity("St. Xavier&apos;s College &amp; Institute"), "st xavier s college institute");
  assert.equal(canonicalIdentity("Teacher&#039;s College"), canonicalIdentity("Teacher's College"));
});

test("detects safe raster bytes and creates immutable content-addressed keys", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.deepEqual(detectRasterImage(png, "application/octet-stream", "https://example.com/file"), { contentType: "image/png", extension: "png" });
  const digest = sha256(png);
  const key = originalMediaKey("gallery", digest, "png");
  assert.equal(key, `legacy-public-assets/original/college-gallery/${digest.slice(0, 2)}/${digest}.png`);
  assert.equal(publicMediaUrl("https://media.example/base", key), `https://media.example/base/${key}`);
});

test("rejects HTML masquerading as an image", () => {
  assert.throws(() => detectRasterImage(Buffer.from("<html>blocked</html>"), "text/html", "https://example.com/a.jpg"), /Unsupported or invalid raster image/);
});

test("stable JSON comparison is independent of object key order", () => {
  assert.equal(stableJson([{ url: "a", caption: "b" }]), stableJson([{ caption: "b", url: "a" }]));
});

test("builds a complete gallery from migrated originals", () => {
  assert.deepEqual(
    buildGalleryReplacement([{ public_url: "new-a" }, { public_url: "new-b" }], ["old-a", "old-b"]),
    { urls: ["new-a", "new-b"], fallbackCount: 0, reason: null },
  );
});

test("preserves the current image only for an unavailable source slot", () => {
  assert.deepEqual(
    buildGalleryReplacement([{ public_url: "new-a" }, null], ["old-a", "old-b"]),
    { urls: ["new-a", "old-b"], fallbackCount: 1, reason: null },
  );
});

test("does not guess gallery positions when source and current lengths differ", () => {
  assert.deepEqual(
    buildGalleryReplacement([{ public_url: "new-a" }, null], ["old-a"]),
    { urls: null, fallbackCount: 0, reason: "current-gallery-length-mismatch" },
  );
});

test("builds the same safe bottom crop used by the legacy sanitizer", () => {
  assert.deepEqual(bottomCropPlan(1600, 900, 12), {
    left: 0,
    top: 0,
    width: 1600,
    height: 792,
    croppedPixels: 108,
  });
  assert.throws(() => bottomCropPlan(1600, 900, 100), /between 0 and 50/);
});

test("creates versioned content-addressed sanitized media keys", () => {
  const digest = "a".repeat(64);
  assert.equal(
    sanitizedOriginalMediaKey("hero", digest),
    `legacy-public-assets/sanitized/bottom-12-v2/college-heroes/aa/${digest}.jpg`,
  );
});

test("builds an exact compare-and-swap manifest for sanitized college media", () => {
  const source = {
    production: { id: "college-1", slug: "example" },
    expected: { image: "old-hero", gallery_images: ["old-gallery"] },
    replacement: { image: "original-hero", gallery_images: ["original-gallery"] },
  };
  const replacements = new Map([
    ["original-hero", "cropped-hero"],
    ["original-gallery", "cropped-gallery"],
  ]);
  const result = buildSanitizedCollegeManifestRow(source, replacements);
  assert.equal(result.unresolved.length, 0);
  assert.deepEqual(result.row.expected, { image: "original-hero", gallery_images: ["original-gallery"] });
  assert.deepEqual(result.row.replacement, { image: "cropped-hero", gallery_images: ["cropped-gallery"] });
});

test("preserves unrelated live galleries when the source row contains only a hero", () => {
  const result = buildSanitizedCollegeManifestRow({
    production: { id: "college-hero-only", slug: "hero-only" },
    expected: { image: "old-hero" },
    replacement: { image: "original-hero" },
  }, new Map([["original-hero", "cropped-hero"]]));

  assert.deepEqual(result.row.expected, { image: "original-hero" });
  assert.deepEqual(result.row.replacement, { image: "cropped-hero" });
  assert.equal(Object.hasOwn(result.row.replacement, "gallery_images"), false);
});

test("rejects a sanitized manifest row if any exact media slot is unresolved", () => {
  const result = buildSanitizedCollegeManifestRow({
    replacement: { image: "original-hero", gallery_images: ["original-gallery"] },
  }, new Map([["original-hero", "cropped-hero"]]));
  assert.equal(result.row, null);
  assert.deepEqual(result.unresolved, [{ field: "gallery_images", index: 0, url: "original-gallery" }]);
});

test("can explicitly omit unavailable gallery slots without changing their order", () => {
  const source = {
    replacement: {
      image: "original-hero",
      gallery_images: ["gallery-a", "dead-gallery", "gallery-c"],
    },
  };
  const replacements = new Map([
    ["original-hero", "cropped-hero"],
    ["gallery-a", "cropped-a"],
    ["gallery-c", "cropped-c"],
  ]);
  const result = buildSanitizedCollegeManifestRow(
    source,
    replacements,
    "bottom-12-v2",
    { dropUnavailableGallery: true },
  );

  assert.deepEqual(result.row.expected, {
    image: "original-hero",
    gallery_images: ["gallery-a", "dead-gallery", "gallery-c"],
  });
  assert.deepEqual(result.row.replacement.gallery_images, ["cropped-a", "cropped-c"]);
  assert.deepEqual(result.droppedGallery, [{
    field: "gallery_images",
    index: 1,
    url: "dead-gallery",
  }]);
  assert.equal(result.row.sanitizer.dropped_unavailable_gallery_assets, 1);
});

test("never substitutes or omits an unavailable hero", () => {
  const result = buildSanitizedCollegeManifestRow({
    replacement: { image: "dead-hero", gallery_images: ["gallery-a"] },
  }, new Map([["gallery-a", "cropped-a"]]), "bottom-12-v2", { dropUnavailableGallery: true });

  assert.equal(result.row, null);
  assert.deepEqual(result.unresolved, [{ field: "image", url: "dead-hero" }]);
  assert.deepEqual(result.droppedGallery, []);
});

test("builds an exact carousel cutover from old WebPs to cropped JPEGs", () => {
  const production = { id: "college-1", slug: "example", name: "Example", city: "Delhi", state: "Delhi" };
  const row = buildCarouselCutoverManifestRow({
    production,
    expected: { image: "old-hero.webp", gallery_images: ["old-a.webp", "old-b.webp"] },
  }, {
    production,
    replacement: { image: "new-hero.jpg", gallery_images: ["new-a.jpg"] },
    sanitizer: { dropped_unavailable_gallery_assets: 1 },
  });

  assert.deepEqual(row.expected.carousel_images, ["old-hero.webp", "old-a.webp", "old-b.webp"]);
  assert.deepEqual(row.replacement.carousel_images, ["new-hero.jpg", "new-a.jpg"]);
  assert.equal(row.sanitizer.carousel_cutover, true);
});

test("rejects carousel cutovers across different colleges", () => {
  assert.throws(() => buildCarouselCutoverManifestRow(
    { production: { id: "college-1" }, expected: { image: "old.webp" } },
    { production: { id: "college-2" }, replacement: { image: "new.jpg" } },
  ), /same production college/);
});

test("rebases a live capped carousel onto exact cropped JPEG counterparts", () => {
  const production = { id: "college-1", slug: "example", name: "Example", city: "Delhi", state: "Delhi" };
  const original = {
    production,
    expected: { image: "old-hero.webp", gallery_images: ["old-a.webp", "old-b.webp"] },
    replacement: { image: "original-hero.jpg", gallery_images: ["original-a.jpg", "original-b.jpg"] },
  };
  const sanitized = {
    production,
    expected: { image: "original-hero.jpg", gallery_images: ["original-a.jpg", "original-b.jpg"] },
    replacement: { image: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v2/college-heroes/new-hero.jpg", gallery_images: [
      "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v2/college-gallery/new-a.jpg",
      "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v2/college-gallery/new-b.jpg",
    ] },
  };
  const result = buildCurrentCarouselCutoverManifestRow(original, sanitized, {
    ...production,
    carousel_images: ["old-hero.webp", "old-a.webp"],
  });

  assert.deepEqual(result.row.expected.carousel_images, ["old-hero.webp", "old-a.webp"]);
  assert.deepEqual(result.row.replacement.carousel_images, [
    sanitized.replacement.image,
    sanitized.replacement.gallery_images[0],
  ]);
  assert.equal(result.dropped, 0);
});

test("drops only explicitly unavailable gallery slots during a live carousel rebase", () => {
  const production = { id: "college-1", slug: "example", name: "Example", city: "Delhi", state: "Delhi" };
  const result = buildCurrentCarouselCutoverManifestRow({
    production,
    expected: { image: "old-hero.webp", gallery_images: ["old-a.webp", "dead.webp", "old-c.webp"] },
    replacement: { image: "original-hero.jpg", gallery_images: ["original-a.jpg", "dead-original.jpg", "original-c.jpg"] },
  }, {
    production,
    expected: { image: "original-hero.jpg", gallery_images: ["original-a.jpg", "dead-original.jpg", "original-c.jpg"] },
    replacement: {
      image: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v2/college-heroes/new-hero.jpg",
      gallery_images: [
        "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v2/college-gallery/new-a.jpg",
        "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v2/college-gallery/new-c.jpg",
      ],
    },
    failed_assets: [{ kind: "gallery", gallery_index: 1 }],
  }, {
    ...production,
    carousel_images: ["old-hero.webp", "old-a.webp", "dead.webp", "old-c.webp"],
  });

  assert.equal(result.dropped, 1);
  assert.equal(result.row.replacement.carousel_images.length, 3);
  assert.match(result.row.replacement.carousel_images[2], /new-c\.jpg$/);
});

test("refuses to overwrite an unmapped custom carousel image", () => {
  const production = { id: "college-1", slug: "example", name: "Example", city: "Delhi", state: "Delhi" };
  const result = buildCurrentCarouselCutoverManifestRow({
    production,
    expected: { image: "old.webp" },
    replacement: { image: "original.jpg" },
  }, {
    production,
    expected: { image: "original.jpg" },
    replacement: { image: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v2/college-heroes/new.jpg" },
  }, {
    ...production,
    carousel_images: ["custom-admin-upload.jpg"],
  });

  assert.equal(result.row, null);
  assert.deepEqual(result.unmapped, ["custom-admin-upload.jpg"]);
});
