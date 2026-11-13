import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { canContentWriterAccess } from "../src/editor-access.mjs";
import { handleRequest } from "../src/index.mjs";
import { prisma } from "../src/db.mjs";
import { createWriterShortLink } from "../src/writer-links.mjs";
import { ensureWriterAuthorProfile, handleWriterProfile, stampWriterByline } from "../src/writer-profile.mjs";

const userId = "11111111-2222-4333-8444-555555555555";

test("writer can read content and edit article drafts, but cannot edit other content", () => {
  for (const resource of ["articles", "colleges", "courses", "exams", "url_mappings"]) {
    assert.equal(canContentWriterAccess(resource, "create"), true);
    assert.equal(canContentWriterAccess(resource, "view"), resource !== "url_mappings");
    assert.equal(canContentWriterAccess(resource, "edit"), resource === "articles");
    for (const action of ["delete", "publish"]) assert.equal(canContentWriterAccess(resource, action), false);
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
  assert.equal(stampWriterByline("articles", { title: "Working draft", slug: "working-draft", status: "Draft", content: "Short" }, author, userId).status, "Draft");
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
  assert.equal(saved.avatar_style, "illustration");
  assert.equal(saved.avatar_emoji, "✍️");
  assert.equal(calls.at(-1)[1], author.id);
  assert.equal(calls.at(-1)[2].is_active, undefined);
  assert.equal(calls.at(-1)[2].user_id, undefined);

  const emojiRequest = new Request("https://example.com/v1/functions/writer-profile", { method: "POST", body: JSON.stringify({ avatar_style: "emoji", avatar_emoji: "📚" }) });
  const emojiProfile = await handleWriterProfile(emojiRequest, userId, database);
  assert.equal(emojiProfile.avatar_style, "emoji");
  assert.equal(emojiProfile.avatar_emoji, "📚");

  const portraitRequest = new Request("https://example.com/v1/functions/writer-profile", { method: "POST", body: JSON.stringify({ avatar_style: "illustration_f" }) });
  const portraitProfile = await handleWriterProfile(portraitRequest, userId, database);
  assert.equal(portraitProfile.avatar_style, "illustration_f");

  const badRequest = new Request("https://example.com/v1/functions/writer-profile", { method: "POST", body: JSON.stringify({ avatar_style: "not-a-style" }) });
  await assert.rejects(() => handleWriterProfile(badRequest, userId, database), /valid writer avatar style/);
});

test("writer can load articles and save college contacts but cannot update another writer's draft", async () => {
  const previousSecret = process.env.AUTH_JWT_SECRET;
  const previousUser = prisma.app_auth_users.findUnique;
  const previousQuery = prisma.$queryRawUnsafe;
  const previousExecute = prisma.$executeRawUnsafe;
  const secret = "synthetic-writer-test-secret-not-a-real-credential";
  process.env.AUTH_JWT_SECRET = secret;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, iat: now, exp: now + 3600 })}`;
  const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
  const sqlSeen = [];
  prisma.app_auth_users.findUnique = async () => ({ id: userId, user_metadata: {}, created_at: new Date(), updated_at: new Date() });
  prisma.$queryRawUnsafe = async (sql, ...params) => {
    sqlSeen.push({ sql, params });
    if (sql.includes("FROM `user_roles`")) return sql.includes("`role` = 'admin'") ? [] : [{ role: "content_writer" }];
    if (sql.includes("FROM `user_permissions`")) return [{ can_publish: 0 }];
    if (sql.includes("COUNT(*)")) return [{ total: 0 }];
    return [];
  };
  prisma.$executeRawUnsafe = async (sql, ...params) => { sqlSeen.push({ sql, params }); return 1; };
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  try {
    const read = await handleRequest(new Request("http://localhost/v1/rest/articles?select=id,title&site_scope=eq.sarkari&limit=10", { headers }));
    assert.equal(read.status, 200, await read.text());
    assert.ok(sqlSeen.some(({ sql, params }) => sql.includes("site_scope") && params.includes("dekhocampus")), JSON.stringify(sqlSeen));
    const contacts = await handleRequest(new Request("http://localhost/v1/rest/college_contacts?select=id,address&college_slug=eq.amity-university-noida", { headers }));
    assert.equal(contacts.status, 200, await contacts.text());
    const contactSave = await handleRequest(new Request("http://localhost/v1/rest/college_contacts?id=eq.11111111-2222-4333-8444-666666666666", {
      method: "PATCH", headers, body: JSON.stringify({ address: "Noida, Uttar Pradesh" }),
    }));
    assert.equal(contactSave.status, 200, await contactSave.text());
    assert.ok(sqlSeen.some(({ sql }) => sql.startsWith("UPDATE `college_contacts` SET")), JSON.stringify(sqlSeen));
    const denied = await handleRequest(new Request(`http://localhost/v1/rest/articles?id=eq.11111111-2222-4333-8444-666666666666`, {
      method: "PATCH", headers, body: JSON.stringify({ title: "Takeover", status: "Draft" }),
    }));
    assert.equal(denied.status, 403, await denied.text());
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET; else process.env.AUTH_JWT_SECRET = previousSecret;
    prisma.app_auth_users.findUnique = previousUser;
    prisma.$queryRawUnsafe = previousQuery;
    prisma.$executeRawUnsafe = previousExecute;
  }
});
