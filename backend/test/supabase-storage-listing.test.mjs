import assert from "node:assert/strict";
import test from "node:test";
import { listSupabaseStorageObjects } from "../src/supabase-storage-listing.mjs";

test("lists large paginated folders without recursive spread overflow", async () => {
  const total = 150_250;
  const objects = await listSupabaseStorageObjects({
    bucket: "admin-uploads",
    pageSize: 1000,
    listPage: async ({ prefix, limit, offset }) => {
      if (!prefix) return offset === 0 ? [{ name: "college-images", id: null, metadata: null }] : [];
      if (prefix !== "college-images") return [];
      return Array.from(
        { length: Math.max(0, Math.min(limit, total - offset)) },
        (_, index) => ({ name: `${offset + index}.webp`, id: `object-${offset + index}`, metadata: { size: 1 } }),
      );
    },
  });

  assert.equal(objects.length, total);
  assert.equal(objects[0].objectPath, "college-images/0.webp");
  assert.equal(objects.at(-1).objectPath, `college-images/${total - 1}.webp`);
});

test("queues each folder once and handles cyclic-looking listings", async () => {
  const calls = [];
  const objects = await listSupabaseStorageObjects({
    bucket: "documents",
    pageSize: 2,
    listPage: async ({ prefix, offset }) => {
      calls.push(`${prefix}:${offset}`);
      if (!prefix && offset === 0) return [{ name: "users" }, { name: "users" }];
      if (!prefix) return [];
      if (prefix === "users" && offset === 0) return [
        { name: "profile.pdf", id: "profile", metadata: { size: 42 } },
        { name: "users" },
      ];
      return [];
    },
  });

  assert.deepEqual(objects.map(({ objectPath }) => objectPath), ["users/profile.pdf"]);
  assert.deepEqual(calls, [":0", ":2", "users:0", "users:2", "users/users:0"]);
});
