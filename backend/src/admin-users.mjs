import { randomUUID } from "node:crypto";
import { prisma } from "./db.mjs";

export const ASSIGNABLE_USER_ROLES = new Set(["admin", "manager", "content_head", "content", "editor", "contributor"]);

const PRIVATE_USER_REFERENCES = [
  ["custom_domains", "user_id"],
  ["profiles", "user_id"],
  ["referrals", "referrer_id"],
  ["sub_users", "parent_user_id"],
  ["target_roadmaps", "user_id"],
  ["url_api_keys", "user_id"],
  ["url_bulk_imports", "user_id"],
  ["url_mappings", "user_id"],
  ["user_consent", "user_id"],
  ["user_documents", "user_id"],
  ["user_education_entries", "user_id"],
  ["user_events", "user_id"],
  ["user_favorites", "user_id"],
  ["user_permissions", "user_id"],
  ["user_roles", "user_id"],
  ["user_sessions", "user_id"],
  ["wallet_transactions", "user_id"],
];

const ANONYMIZED_USER_REFERENCES = [
  ["ai_usage_events", "user_id"],
  ["api_logs", "user_id"],
  ["articles", "created_by"],
  ["authors", "user_id"],
  ["college_applications", "user_id"],
  ["college_reviews", "user_id"],
  ["cta_events", "user_id"],
  ["intent_events", "user_id"],
  ["push_leads", "user_id"],
  ["upload_batches", "user_id"],
];

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function asMetadata(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeAdminUserEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return null;
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, "INVALID_USER_EMAIL", "Enter a valid email address");
  }
  return email;
}

export function normalizeAdminUserPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  const mobile = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw httpError(400, "INVALID_USER_PHONE", "Enter a valid 10-digit Indian mobile number");
  }
  return `+91${mobile}`;
}

function normalizeDisplayName(value) {
  const displayName = String(value || "").trim().replace(/\s+/g, " ");
  if (displayName.length > 120) throw httpError(400, "INVALID_DISPLAY_NAME", "Display name must be 120 characters or fewer");
  return displayName || null;
}

async function lockedTarget(tx, userId) {
  const rows = await tx.$queryRawUnsafe(
    "SELECT `id`,`email`,`phone`,`provider`,`user_metadata` FROM `app_auth_users` WHERE `id` = ? LIMIT 1 FOR UPDATE",
    userId,
  );
  const profiles = await tx.$queryRawUnsafe(
    "SELECT `id`,`user_id`,`display_name`,`email`,`phone` FROM `profiles` WHERE `user_id` = ? LIMIT 1 FOR UPDATE",
    userId,
  );
  const authUser = rows[0] || null;
  const profile = profiles[0] || null;
  if (!authUser && !profile) throw httpError(404, "USER_NOT_FOUND", "User not found");
  return { authUser, profile };
}

async function distinctAdminIds(tx) {
  const rows = await tx.$queryRawUnsafe("SELECT `user_id` FROM `user_roles` WHERE `role` = 'admin' FOR UPDATE");
  return new Set(rows.map((row) => String(row.user_id)));
}

export async function updateAdminUser(database, actorUserId, input) {
  const userId = String(input.user_id || "").trim();
  if (!userId) throw httpError(400, "USER_ID_REQUIRED", "Select a user to edit");

  return database.$transaction(async (tx) => {
    const { authUser, profile } = await lockedTarget(tx, userId);
    const displayName = Object.hasOwn(input, "display_name") ? normalizeDisplayName(input.display_name) : profile?.display_name || null;
    const email = Object.hasOwn(input, "email") ? normalizeAdminUserEmail(input.email) : authUser?.email || profile?.email || null;
    const phone = Object.hasOwn(input, "phone") ? normalizeAdminUserPhone(input.phone) : authUser?.phone || profile?.phone || null;

    if (authUser && !email && !phone) {
      throw httpError(400, "LOGIN_IDENTITY_REQUIRED", "A login user must keep an email address or mobile number");
    }

    if (authUser) {
      const metadata = asMetadata(authUser.user_metadata);
      await tx.app_auth_users.update({
        where: { id: userId },
        data: {
          email,
          phone,
          user_metadata: { ...metadata, full_name: displayName, name: displayName },
        },
      });
    }

    if (profile) {
      await tx.profiles.update({ where: { id: profile.id }, data: { display_name: displayName, email, phone } });
    } else {
      await tx.profiles.create({ data: { id: randomUUID(), user_id: userId, display_name: displayName, email, phone } });
    }

    return { success: true, user_id: userId, display_name: displayName, email, phone, has_auth_identity: Boolean(authUser), updated_by: actorUserId };
  }).catch((error) => {
    if (error?.code === "P2002") throw httpError(409, "USER_IDENTITY_EXISTS", "That email address or mobile number already belongs to another user");
    throw error;
  });
}

export async function setAdminUserRole(database, actorUserId, input) {
  const userId = String(input.user_id || "").trim();
  const role = String(input.role || "").trim();
  const enabled = input.enabled === true;
  if (!userId) throw httpError(400, "USER_ID_REQUIRED", "Select a user");
  if (!ASSIGNABLE_USER_ROLES.has(role)) throw httpError(400, "INVALID_USER_ROLE", "Select a supported role");
  if (!enabled && role === "admin" && userId === actorUserId) {
    throw httpError(409, "CURRENT_ADMIN_PROTECTED", "You cannot remove your own administrator role while signed in");
  }

  return database.$transaction(async (tx) => {
    await lockedTarget(tx, userId);
    if (!enabled && role === "admin") {
      const admins = await distinctAdminIds(tx);
      if (admins.has(userId) && admins.size <= 1) {
        throw httpError(409, "LAST_ADMIN_PROTECTED", "The last administrator cannot be removed");
      }
    }

    if (enabled) {
      const existing = await tx.user_roles.findFirst({ where: { user_id: userId, role } });
      if (!existing) await tx.user_roles.create({ data: { id: randomUUID(), user_id: userId, role } });
    } else {
      await tx.user_roles.deleteMany({ where: { user_id: userId, role } });
    }
    return { success: true, user_id: userId, role, enabled };
  });
}

export async function deleteAdminUser(database, actorUserId, input) {
  const userId = String(input.user_id || "").trim();
  if (!userId || input.confirm_user_id !== userId) {
    throw httpError(400, "DELETE_CONFIRMATION_REQUIRED", "Confirm the exact user before deleting the account");
  }
  if (userId === actorUserId) throw httpError(409, "CURRENT_USER_PROTECTED", "You cannot delete your own active account");

  return database.$transaction(async (tx) => {
    const { authUser, profile } = await lockedTarget(tx, userId);
    const admins = await distinctAdminIds(tx);
    if (admins.has(userId) && admins.size <= 1) {
      throw httpError(409, "LAST_ADMIN_PROTECTED", "The last administrator cannot be deleted");
    }

    for (const [table, column] of ANONYMIZED_USER_REFERENCES) {
      await tx.$executeRawUnsafe(`UPDATE \`${table}\` SET \`${column}\` = NULL WHERE \`${column}\` = ?`, userId);
    }
    for (const [table, column] of PRIVATE_USER_REFERENCES) {
      await tx.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE \`${column}\` = ?`, userId);
    }
    await tx.$executeRawUnsafe("UPDATE `team_invites` SET `created_by` = NULL WHERE `created_by` = ?", userId);
    await tx.$executeRawUnsafe("DELETE FROM `team_invites` WHERE `accepted_user_id` = ? OR (`email` IS NOT NULL AND `email` = ?) OR (`phone` IS NOT NULL AND `phone` = ?)", userId, authUser?.email || profile?.email || "", authUser?.phone || profile?.phone || "");
    if (authUser?.phone) await tx.app_auth_otps.deleteMany({ where: { phone: authUser.phone } });
    if (authUser) {
      await tx.app_auth_refresh_tokens.deleteMany({ where: { user_id: userId } });
      await tx.app_auth_users.delete({ where: { id: userId } });
    }
    return { success: true, deleted_user_id: userId };
  });
}

export async function handleAdminUsers(request, actorUserId, database = prisma) {
  if (request.method !== "POST") throw httpError(405, "METHOD_NOT_ALLOWED", "Use POST for administrator user changes");
  const body = await request.json().catch(() => ({}));
  if (body.action === "update") return updateAdminUser(database, actorUserId, body);
  if (body.action === "set_role") return setAdminUserRole(database, actorUserId, body);
  if (body.action === "delete") return deleteAdminUser(database, actorUserId, body);
  throw httpError(400, "INVALID_ADMIN_USER_ACTION", "Choose update, set_role, or delete");
}
