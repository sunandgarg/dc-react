import test from "node:test";
import assert from "node:assert/strict";
import { canContentWriterAccess } from "../src/editor-access.mjs";
import { createWriterShortLink } from "../src/writer-links.mjs";
import { ensureWriterAuthorProfile, handleWriterProfile, stampWriterByline } from "../src/writer-profile.mjs";

const userId = "11111111-2222-4333-8444-555555555555";

test("writer may only create four content types and new short links", () => {
  for (const resource of ["articles", "colleges", "courses", "exams", "url_mappings"]) {
    assert.equal(canContentWriterAccess(resource, "create"), true);
    for (const action of ["view", "edit", "delete", "publish"]) {
      assert.equal(canContentWriterAccess(resource, action), false);
    }
  }
  assert.equal(canContentWriterAccess("users", "create"), false);
  assert.equal(canContentWriterAccess("authors", "create"), false);
});

test("server stamps the signed-in writer's ID and author profile on every submitted type", () => {
  const author = { id: "author-123", name: "Neha" };
  for (const table of ["articles", "colleges", "courses", "exams"]) {
    const row = stampWriterByline(table, { id: "forged", name: "Test", title: "Test", slug: "test-new-item", description: "A useful description", content: "A full article body with enough detail to publish.", author_id: "another-author", author: "Someone Else", created_by: "another-user" }, author, userId);
    assert.equal(row.id, undefined);
    assert.equal(row.author_id, author.id);
    if (table === "articles") {
      assert.equal(row.author, "Neha");
      assert.equal(row.created_by, userId);
    }
  }
  assert.throws(() => stampWriterByline("articles", [{ title: "A" }, { title: "B" }], author, userId), /one new item/);
  assert.throws(() => stampWriterByline("articles", { title: "Incomplete", slug: "incomplete", content: "Short" }, author, userId), /useful description/);
});

test("writer short links use server-owned identity, code and domain", () => {
  const row = createWriterShortLink({
    title: "Official notice", original_url: "https://example.gov.in/notice",
    user_id: "forged", short_code: "fake", domain: "attacker.example", is_active: false,
  }, userId);
  assert.equal(row.user_id, userId);
  assert.match(row.short_code, /^[A-Za-z0-9_-]{12}$/);
  assert.equal(row.domain, null);
  assert.equal(row.is_active, true);
  assert.equal(row.original_url, "https://example.gov.in/notice");
  for (const destination of ["http://example.com", "https://localhost/page", "https://127.0.0.1/page", "https://user:pass@example.com/"]) {
    assert.throws(() => createWriterShortLink({ title: "Bad", original_url: destination }, userId), /public HTTPS/);
  }
});

test("writer can save only their own byline profile", async () => {
  const author = { id: "author-123", name: "Neha", photo: "", designation: "Content Writer", short_bio: "", bio: "", expertise: [], linkedin_url: "", twitter_url: "", website_url: "" };
  const calls = [];
  const database = {
    authors: {
      findFirst: async (query) => { calls.push(["find", query.where.user_id]); return author; },
      update: async (query) => { calls.push(["update", query.where.id, query.data]); return { ...author, ...query.data }; },
    },
    profiles: { findFirst: async () => ({ display_name: "Neha" }) },
  };
  assert.equal((await ensureWriterAuthorProfile(database, userId)).id, author.id);
  const request = new Request("https://example.com/v1/functions/writer-profile", { method: "POST", body: JSON.stringify({
    name: "Neha S", user_id: "another-user", id: "another-author", is_active: false,
  }) });
  const saved = await handleWriterProfile(request, userId, database);
  assert.equal(saved.name, "Neha S");
  assert.equal(calls.at(-1)[1], author.id);
  assert.equal(calls.at(-1)[2].is_active, undefined);
  assert.equal(calls.at(-1)[2].user_id, undefined);
});
