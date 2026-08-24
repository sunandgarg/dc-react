import assert from "node:assert/strict";
import test from "node:test";
import { configured } from "../src/integration-status.mjs";
import { isOwnerAdminPhone } from "../src/auth.mjs";

test("reports only non-empty integration values as configured", () => {
  assert.equal(configured(" secret "), true);
  assert.equal(configured(""), false);
  assert.equal(configured(null), false);
});

test("recognizes the two owner administrator phone numbers", () => {
  assert.equal(isOwnerAdminPhone("+91 8700602524"), true);
  assert.equal(isOwnerAdminPhone("9990109393"), true);
  assert.equal(isOwnerAdminPhone("9876543210"), false);
});
