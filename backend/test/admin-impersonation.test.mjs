import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { auditImpersonatedWrite, resolveNativeIdentity, startAdminImpersonation, stopAdminImpersonation, verifyAccessToken } from "../src/auth.mjs";

const SECRET = "test-admin-impersonation-secret-over-32-characters";
process.env.AUTH_JWT_SECRET = SECRET;
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const WRITER_ID = "22222222-2222-4222-8222-222222222222";
const now = () => Math.floor(Date.now() / 1000);
const row = (id) => ({ id, phone: "+919999999999", provider: "phone", user_metadata: {}, created_at: new Date(), updated_at: new Date() });

function token(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function fakeDatabase(adminRole = true, targetExists = true) {
  const events = [];
  const settings = new Map();
  const database = {
    events, settings,
    $transaction: async (callback) => callback(database),
    app_auth_users: { findUnique: async ({ where }) => {
      if (where.id === ADMIN_ID) return row(ADMIN_ID);
      return targetExists && where.id === WRITER_ID ? row(WRITER_ID) : null;
    } },
    user_roles: { findFirst: async ({ where }) => adminRole && where.user_id === ADMIN_ID && where.role === "admin" ? { id: "role" } : null },
    app_settings: {
      create: async ({ data }) => { settings.set(data.key, data); return data; },
      findUnique: async ({ where }) => settings.get(where.key) || null,
      update: async ({ where, data }) => { const row = { ...settings.get(where.key), ...data }; settings.set(where.key, row); return row; },
    },
    system_logs: { create: async ({ data }) => { events.push(data); return data; } },
  };
  return database;
}

function startRequest(accessToken, target = WRITER_ID) {
  return new Request("https://example.test/auth/v1/impersonate", {
    method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ user_id: target }),
  });
}

test("administrator can open a 15-minute writer session without a refresh credential", async () => {
  const database = fakeDatabase();
  const adminToken = token({ sub: ADMIN_ID, iat: now(), exp: now() + 3600 });
  const session = await startAdminImpersonation(startRequest(adminToken), database);
  const payload = verifyAccessToken(session.access_token);
  assert.equal(payload.sub, WRITER_ID);
  assert.equal(payload.admin_id, ADMIN_ID);
  assert.equal(payload.session, "impersonation");
  assert.equal(payload.exp - payload.iat, 900);
  assert.equal(session.refresh_token, undefined);
  assert.equal(database.events[0].flow, "started");
  assert.equal(database.events[0].context.target_user_id, WRITER_ID);

  const viewed = await resolveNativeIdentity(new Request("https://example.test/auth/v1/user", { headers: { authorization: `Bearer ${session.access_token}` } }), database);
  assert.equal(viewed.id, WRITER_ID);
  assert.equal(viewed.impersonation.admin_user_id, ADMIN_ID);

  const write = new Request("https://example.test/v1/rest/articles", { method: "POST", headers: { authorization: `Bearer ${session.access_token}` } });
  await auditImpersonatedWrite(write, database);
  assert.equal(database.events[1].flow, "admin_impersonation_write");
  assert.equal(database.events[1].method, "POST");
});

test("non-admin and delegated sessions cannot start another impersonation", async () => {
  const adminToken = token({ sub: ADMIN_ID, iat: now(), exp: now() + 3600 });
  await assert.rejects(startAdminImpersonation(startRequest(adminToken), fakeDatabase(false)), (error) => error.code === "ADMIN_REQUIRED");
  const delegated = token({ sub: WRITER_ID, admin_id: ADMIN_ID, impersonation_id: "session", session: "impersonation", iat: now(), exp: now() + 900 });
  await assert.rejects(startAdminImpersonation(startRequest(delegated), fakeDatabase()), (error) => error.code === "ADMIN_SESSION_REQUIRED");
});

test("target must have a real login account", async () => {
  const adminToken = token({ sub: ADMIN_ID, iat: now(), exp: now() + 3600 });
  await assert.rejects(startAdminImpersonation(startRequest(adminToken), fakeDatabase(true, false)), (error) => error.code === "TARGET_AUTH_NOT_FOUND");
});

test("removing the administrator role immediately invalidates the delegated session", async () => {
  const database = fakeDatabase();
  const session = await startAdminImpersonation(startRequest(token({ sub: ADMIN_ID, iat: now(), exp: now() + 3600 })), database);
  const request = new Request("https://example.test/v1/rest/articles", { headers: { authorization: `Bearer ${session.access_token}` } });
  database.user_roles.findFirst = async () => null;
  assert.equal(await resolveNativeIdentity(request, database), null);
});

test("returning to admin revokes the delegated token immediately", async () => {
  const database = fakeDatabase();
  const session = await startAdminImpersonation(startRequest(token({ sub: ADMIN_ID, iat: now(), exp: now() + 3600 })), database);
  const headers = { authorization: `Bearer ${session.access_token}` };
  assert.equal(await resolveNativeIdentity(new Request("https://example.test/auth/v1/user", { headers }), database) !== null, true);
  await stopAdminImpersonation(new Request("https://example.test/auth/v1/impersonate/stop", { method: "POST", headers }), database);
  assert.equal(await resolveNativeIdentity(new Request("https://example.test/auth/v1/user", { headers }), database), null);
  assert.equal(database.events.at(-1).flow, "stopped");
});
