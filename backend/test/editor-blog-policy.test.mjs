import test from "node:test";
import assert from "node:assert/strict";
import { isRestrictedEditorPhone } from "../src/editor-access.mjs";
import { blogLimits } from "../src/blog-ai.mjs";

test("recognizes only the restricted content editor phone", () => {
  assert.equal(isRestrictedEditorPhone("9818308623"), true);
  assert.equal(isRestrictedEditorPhone("+91 98183 08623"), true);
  assert.equal(isRestrictedEditorPhone("8700602524"), false);
});

test("enforces conservative auto-blog cadence and volume limits", () => {
  assert.deepEqual(blogLimits, {
    MAX_POSTS_PER_RUN: 10,
    MAX_DAILY_POSTS: 48,
    MIN_INTERVAL_MINUTES: 30,
  });
});

