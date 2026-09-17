import assert from "node:assert/strict";
import test from "node:test";
import {
  collectStoredMediaObjectKeys,
  toPublicMediaUrls,
  toStoredMediaKeys,
  toStoredMediaObjectKey,
} from "../src/media-values.mjs";

test("stores public media as provider-neutral keys", () => {
  const previous = process.env.MEDIA_BASE_URL;
  process.env.MEDIA_BASE_URL = "https://media.example";
  try {
    assert.equal(
      toStoredMediaKeys("https://media.example/admin-uploads/college/logo.webp"),
      "admin-uploads/college/logo.webp",
    );
    assert.equal(
      toStoredMediaKeys("https://dekhocampus.com/storage/v1/object/public/admin-uploads/college/logo.webp"),
      "admin-uploads/college/logo.webp",
    );
    assert.equal(
      toStoredMediaKeys("https://old-media.example/storage/v1/object/public/admin-uploads/college/logo.webp"),
      "admin-uploads/college/logo.webp",
    );
  } finally {
    if (previous === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = previous;
  }
});

test("expands known object keys only when returning API data", () => {
  const previous = process.env.MEDIA_BASE_URL;
  process.env.MEDIA_BASE_URL = "https://media.example";
  try {
    const value = toPublicMediaUrls({
      logo: "admin-uploads/college/logo.webp",
      website: "https://university.example/admissions",
      description: "ordinary/path/text",
      nested: ["user-documents/user/transcript.pdf"],
    });
    assert.equal(value.logo, "https://media.example/admin-uploads/college/logo.webp");
    assert.equal(value.website, "https://university.example/admissions");
    assert.equal(value.description, "ordinary/path/text");
    assert.equal(value.nested[0], "user-documents/user/transcript.pdf");
    assert.equal(
      toPublicMediaUrls("legacy-public-assets/sanitized/college.webp"),
      "https://media.example/legacy-public-assets/sanitized/college.webp",
    );
    assert.equal(
      toPublicMediaUrls("study-material/notes/physics.pdf"),
      "https://media.example/study-material/notes/physics.pdf",
    );
  } finally {
    if (previous === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = previous;
  }
});

test("normalizes raw and public media references to the same S3 object key", () => {
  const key = "legacy-public-assets/sanitized/bottom-12-v1/college-heroes/aa/example.webp";
  const publicUrl = `https://aws-origin.dekhocampus.com/storage/v1/object/public/${key}`;
  assert.equal(toStoredMediaObjectKey(key), key);
  assert.equal(toStoredMediaObjectKey(publicUrl), key);
  assert.equal(toStoredMediaObjectKey("https://university.example/image.webp"), "");
});

test("collects canonical S3 keys from nested database media values", () => {
  const prefix = "legacy-public-assets/sanitized/bottom-12-v1/";
  const hero = `${prefix}college-heroes/aa/hero.webp`;
  const gallery = `${prefix}college-gallery/bb/gallery.webp`;
  assert.deepEqual(
    collectStoredMediaObjectKeys({ hero, gallery: [`https://aws-origin.dekhocampus.com/storage/v1/object/public/${gallery}`], external: "https://example.com/photo.jpg" }, prefix),
    [hero, gallery],
  );
});
