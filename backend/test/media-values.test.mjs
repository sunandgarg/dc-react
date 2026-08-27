import assert from "node:assert/strict";
import test from "node:test";
import { toPublicMediaUrls, toStoredMediaKeys } from "../src/media-values.mjs";

test("stores public media as provider-neutral keys", () => {
  const previous = process.env.MEDIA_BASE_URL;
  process.env.MEDIA_BASE_URL = "https://cdn-legacy.dekhocampus.com";
  try {
    assert.equal(
      toStoredMediaKeys("https://cdn-legacy.dekhocampus.com/admin-uploads/college/logo.webp"),
      "admin-uploads/college/logo.webp",
    );
    assert.equal(
      toStoredMediaKeys("https://dekhocampus.com/storage/v1/object/public/admin-uploads/college/logo.webp"),
      "admin-uploads/college/logo.webp",
    );
  } finally {
    if (previous === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = previous;
  }
});

test("expands known object keys only when returning API data", () => {
  const previous = process.env.MEDIA_BASE_URL;
  process.env.MEDIA_BASE_URL = "https://cdn-legacy.dekhocampus.com";
  try {
    const value = toPublicMediaUrls({
      logo: "admin-uploads/college/logo.webp",
      website: "https://university.example/admissions",
      description: "ordinary/path/text",
      nested: ["user-documents/user/transcript.pdf"],
    });
    assert.equal(value.logo, "https://cdn-legacy.dekhocampus.com/admin-uploads/college/logo.webp");
    assert.equal(value.website, "https://university.example/admissions");
    assert.equal(value.description, "ordinary/path/text");
    assert.equal(value.nested[0], "https://cdn-legacy.dekhocampus.com/user-documents/user/transcript.pdf");
    assert.equal(
      toPublicMediaUrls("legacy-public-assets/sanitized/college.webp"),
      "https://cdn-legacy.dekhocampus.com/legacy-public-assets/sanitized/college.webp",
    );
    assert.equal(
      toPublicMediaUrls("study-material/notes/physics.pdf"),
      "https://cdn-legacy.dekhocampus.com/study-material/notes/physics.pdf",
    );
  } finally {
    if (previous === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = previous;
  }
});
