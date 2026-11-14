import assert from "node:assert/strict";
import test from "node:test";
import { attributionFromPageUrl } from "../scripts/lead-attribution-backfill.mjs";

test("recovers campaign tags from historical lead URLs", () => {
  assert.deepEqual(attributionFromPageUrl("/ad/jee-main-2027?utm_source=Meta&utm_medium=paid%20social&utm_campaign=JEE%202027"), {
    utm_source: "Meta", utm_medium: "paid social", utm_campaign: "JEE 2027",
  });
  assert.deepEqual(attributionFromPageUrl("https://dekhocampus.com/news?UTM_SOURCE=search"), { utm_source: "search" });
  assert.deepEqual(attributionFromPageUrl("/news/jee-main-2027"), {});
  assert.deepEqual(attributionFromPageUrl("https://%"), {});
});
