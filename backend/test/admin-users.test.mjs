import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAdminUserEmail, normalizeAdminUserPhone, setAdminUserRole, setContentWriterPublish } from "../src/admin-users.mjs";

test("administrator user edits normalize login identities", () => {
  assert.equal(normalizeAdminUserEmail("  Writer@Example.COM "), "writer@example.com");
  assert.equal(normalizeAdminUserPhone("+91 88103 23087"), "+918810323087");
  assert.equal(normalizeAdminUserEmail(""), null);
  assert.equal(normalizeAdminUserPhone(""), null);
  assert.throws(() => normalizeAdminUserEmail("not-an-email"), (error) => error?.code === "INVALID_USER_EMAIL");
  assert.throws(() => normalizeAdminUserPhone("123"), (error) => error?.code === "INVALID_USER_PHONE");
});

test("an administrator cannot remove their own active admin role", async () => {
  await assert.rejects(
    setAdminUserRole({}, "admin-1", { user_id: "admin-1", role: "admin", enabled: false }),
    (error) => error?.code === "CURRENT_ADMIN_PROTECTED",
  );
});

test("role grants are idempotent and never create duplicate rows", async () => {
  let creates = 0;
  const tx = {
    $queryRawUnsafe: async (sql) => sql.includes("app_auth_users")
      ? [{ id: "user-1", email: "user@example.com", phone: null, provider: "email", user_metadata: {} }]
      : [{ id: "profile-1", user_id: "user-1", display_name: "User", email: "user@example.com", phone: null }],
    user_roles: {
      findFirst: async () => ({ id: "existing-role" }),
      create: async () => { creates += 1; },
    },
  };
  const database = { $transaction: async (callback) => callback(tx) };

  const result = await setAdminUserRole(database, "admin-1", { user_id: "user-1", role: "content", enabled: true });

  assert.equal(result.enabled, true);
  assert.equal(creates, 0);
});

test("writer publishing switch changes only publishing and never edit or delete", async () => {
  let invitePermissions;
  let applied;
  const tx = {
    team_invites: {
      findUnique: async () => ({ id: "invite-1", role: "content_writer", status: "accepted", accepted_user_id: "writer-1" }),
      update: async ({ data }) => { invitePermissions = data.permissions; },
    },
    user_roles: { findFirst: async () => ({ id: "role-1" }) },
    user_permissions: { updateMany: async ({ where, data }) => { applied = { where, data }; } },
  };
  const database = { $transaction: async (callback) => callback(tx) };
  await setContentWriterPublish(database, { invite_id: "invite-1", direct_publish: true });
  assert.equal(invitePermissions.length, 4);
  assert.equal(invitePermissions.every((permission) => permission.can_publish && !permission.can_edit && !permission.can_delete), true);
  assert.equal(applied.data.can_publish, true);
  assert.equal(applied.data.can_edit, false);
  assert.equal(applied.data.can_delete, false);
});
