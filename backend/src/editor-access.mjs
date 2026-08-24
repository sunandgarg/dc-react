import { randomUUID } from "node:crypto";
import { prisma } from "./db.mjs";

const RESTRICTED_EDITOR_PHONE = "9818308623";
const RESTRICTED_EDITOR_GRANTS = [
  { resource: "colleges", can_view: true, can_create: true, can_edit: true },
  { resource: "courses", can_view: true, can_create: true, can_edit: true },
  { resource: "exams", can_view: true, can_create: true, can_edit: true },
  { resource: "articles", can_view: true, can_create: true, can_edit: false },
];

export function isRestrictedEditorPhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10) === RESTRICTED_EDITOR_PHONE;
}

export async function ensureRestrictedEditorAccess(userId, phone) {
  if (!userId || !isRestrictedEditorPhone(phone)) return false;

  await prisma.$transaction(async (tx) => {
    // This account is intentionally content-only. Explicit grants are easier
    // to audit than a broad role and cannot expose unrelated admin modules.
    await tx.$executeRawUnsafe("DELETE FROM `user_roles` WHERE `user_id` = ?", userId);
    await tx.$executeRawUnsafe("DELETE FROM `user_permissions` WHERE `user_id` = ?", userId);
    for (const grant of RESTRICTED_EDITOR_GRANTS) {
      await tx.$executeRawUnsafe(
        `INSERT INTO \`user_permissions\`
          (\`id\`,\`user_id\`,\`module\`,\`action\`,\`allow\`,\`created_at\`,\`resource\`,\`can_view\`,\`can_create\`,\`can_edit\`,\`can_delete\`,\`scope\`,\`updated_at\`,\`can_publish\`)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        randomUUID(), userId, grant.resource, "view", true, new Date(), grant.resource,
        grant.can_view, grant.can_create, grant.can_edit, false, "all", new Date(), false,
      );
    }
  });
  return true;
}

export async function provisionExistingRestrictedEditor() {
  const variants = [RESTRICTED_EDITOR_PHONE, `+91${RESTRICTED_EDITOR_PHONE}`];
  const rows = await prisma.$queryRawUnsafe(
    "SELECT `id`,`phone` FROM `app_auth_users` WHERE `phone` IN (?,?) LIMIT 1",
    ...variants,
  );
  if (!rows[0]) return false;
  return ensureRestrictedEditorAccess(rows[0].id, rows[0].phone);
}

