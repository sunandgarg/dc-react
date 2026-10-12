import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleRequest } from "../src/index.mjs";
import { prisma } from "../src/db.mjs";

test("Content Head FAQ deletion is authorized through the API, without granting other destructive access", async () => {
  const previousSecret = process.env.AUTH_JWT_SECRET;
  const previousUser = prisma.app_auth_users.findUnique;
  const previousQuery = prisma.$queryRawUnsafe;
  const previousExecute = prisma.$executeRawUnsafe;
  const previousTransaction = prisma.$transaction;
  const previousFaqs = prisma.faqs.findMany;
  const previousDelete = prisma.faqs.deleteMany;
  const secret = "synthetic-faq-permission-test-secret-not-a-real-credential";
  process.env.AUTH_JWT_SECRET = secret;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "test-head", iat: now, exp: now + 3600 })}`;
  const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
  let role = "content_head";
  const writes = [];
  const article = { id: "test-article", slug: "test-article", title: "Test article", site_scope: "dekhocampus", status: "Draft", tags: [] };
  const faq = { id: "11111111-2222-4333-8444-555555555555", page: "articles", item_slug: article.slug, question: "Question?", answer: "Answer" };
  prisma.app_auth_users.findUnique = async ({ where }) => ({ id: where.id, user_metadata: {}, created_at: new Date(), updated_at: new Date() });
  prisma.$queryRawUnsafe = async (sql, ...params) => {
    if (sql.includes("FROM `user_roles`")) {
      if (sql.includes("`role` = 'admin'")) return role === "admin" ? [{ 1: 1 }] : [];
      if (sql.includes("`role` = 'content_head'")) return role === "content_head" ? [{ 1: 1 }] : [];
      return [{ role }];
    }
    if (sql.includes("article_write_locks")) return [{ site_scope: params[0] }];
    if (sql.includes("FROM `articles`")) return [article];
    return [];
  };
  prisma.$executeRawUnsafe = async (sql, ...params) => { writes.push({ sql, params }); return 1; };
  prisma.$transaction = async (operation) => operation(prisma);
  prisma.faqs.findMany = async () => [faq];
  prisma.faqs.deleteMany = async (args) => { writes.push(args); return { count: 1 }; };
  const request = (table, query, method = "DELETE", body) => new Request(`http://localhost/v1/rest/${table}?${query}`, {
    method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    for (const page of ["articles", "sarkari_articles", "colleges", "courses", "exams"]) {
      const response = await handleRequest(request("faqs", `id=eq.test-faq&page=eq.${page}&item_slug=eq.test-entity`));
      assert.equal(response.status, 200, await response.text());
      assert.match(writes.at(-1).sql, /DELETE FROM `faqs`.*`page` = \?/);
      assert.deepEqual(writes.at(-1).params, ["test-faq", page, "test-entity"]);
    }
    const count = writes.length;
    for (const query of ["id=eq.test-faq", "page=eq.home", "page=neq.home", "page=eq.exams&page=eq.home"]) {
      assert.equal((await handleRequest(request("faqs", query))).status, 403);
    }
    for (const table of ["articles", "colleges", "courses", "exams", "authors"]) {
      assert.equal((await handleRequest(request(table, "id=eq.test-entity"))).status, 403);
    }
    for (role of ["manager", "content", "content_writer", "editor", "user"]) {
      assert.equal((await handleRequest(request("faqs", "id=eq.test-faq&page=eq.exams"))).status, 403);
    }
    assert.equal(writes.length, count);
    role = "content_head";
    const response = await handleRequest(request("articles", "id=eq.test-article&site_scope=eq.dekhocampus", "PATCH", { faqs: [] }));
    assert.equal(response.status, 200, await response.text());
    assert.deepEqual(writes.at(-1), { where: { page: "articles", item_slug: article.slug, id: { in: [faq.id] } } });
    role = "admin";
    assert.equal((await handleRequest(request("faqs", "id=eq.test-faq&page=eq.home"))).status, 200);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET; else process.env.AUTH_JWT_SECRET = previousSecret;
    prisma.app_auth_users.findUnique = previousUser;
    prisma.$queryRawUnsafe = previousQuery;
    prisma.$executeRawUnsafe = previousExecute;
    prisma.$transaction = previousTransaction;
    prisma.faqs.findMany = previousFaqs;
    prisma.faqs.deleteMany = previousDelete;
  }
});
