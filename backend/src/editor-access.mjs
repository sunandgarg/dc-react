import { randomUUID } from "node:crypto";
import { prisma } from "./db.mjs";

const RESTRICTED_EDITOR_PHONE = "7428966263";
const FORMER_RESTRICTED_EDITOR_PHONE = "9818308623";
export const CONTENT_EDITOR_RESOURCES = new Set([
  "articles", "article_categories", "article_links", "authors",
  "colleges", "college_contacts", "college_facilities", "college_few_links",
  "college_programs", "college_quick_links", "college_resources", "college_semesters",
  "college_subjects", "college_toppers", "college_universities",
  "courses", "course_fees", "course_specializations", "exams",
  "career_profiles", "career_course_links", "companies", "placement_records",
  "faculty", "facilities_library", "scholarships", "jobs",
  "study_board_links", "study_boards", "study_chapters", "study_resources",
  "study_subjects", "study_toppers", "faqs", "popular_places",
  "program_categories", "programs", "promoted_programs", "stream_categories",
]);
const RESTRICTED_EDITOR_GRANTS = [
  { resource: "colleges", can_view: true, can_create: true, can_edit: true },
  { resource: "college_contacts", can_view: true, can_create: true, can_edit: true },
  { resource: "course_fees", can_view: true, can_create: true, can_edit: true },
  { resource: "faculty", can_view: true, can_create: true, can_edit: true },
  { resource: "courses", can_view: true, can_create: true, can_edit: true },
  { resource: "career_course_links", can_view: true, can_create: true, can_edit: true },
  { resource: "exams", can_view: true, can_create: true, can_edit: true },
  { resource: "faqs", can_view: true, can_create: true, can_edit: true },
  { resource: "articles", can_view: true, can_create: true, can_edit: true },
];

export function isRestrictedEditorPhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10) === RESTRICTED_EDITOR_PHONE;
}

export function canContentEditorAccess(resource, action) {
  return CONTENT_EDITOR_RESOURCES.has(String(resource || ""))
    && ["view", "create", "edit"].includes(String(action || ""));
}

export async function acceptPendingTeamInvite(user) {
  const phone = String(user?.phone || "").replace(/\D/g, "").slice(-10);
  if (!user?.id || !phone) return false;
  const invite = await prisma.team_invites.findFirst({
    where: { status: "pending", OR: [{ phone }, { phone: `+91${phone}` }] },
    orderBy: { created_at: "desc" },
  });
  if (!invite) return false;

  await prisma.$transaction(async (tx) => {
    const existingRole = await tx.user_roles.findFirst({ where: { user_id: user.id, role: invite.role } });
    if (!existingRole) await tx.user_roles.create({ data: { id: randomUUID(), user_id: user.id, role: invite.role } });
    const permissions = Array.isArray(invite.permissions) ? invite.permissions : [];
    for (const permission of permissions) {
      if (!permission?.resource) continue;
      await tx.user_permissions.create({
        data: {
          id: randomUUID(), user_id: user.id, module: permission.resource, action: "view",
          allow: true, resource: permission.resource, scope: "all",
          can_view: Boolean(permission.can_view), can_create: Boolean(permission.can_create),
          can_edit: Boolean(permission.can_edit), can_delete: Boolean(permission.can_delete),
          can_publish: Boolean(permission.can_publish),
        },
      });
    }
    await tx.profiles.updateMany({
      where: { user_id: user.id },
      data: {
        ...(invite.display_name ? { display_name: invite.display_name } : {}),
        mask_leads: invite.mask_leads,
        updated_at: new Date(),
      },
    });
    await tx.team_invites.update({
      where: { id: invite.id },
      data: { status: "accepted", accepted_user_id: user.id, updated_at: new Date() },
    });
  });
  return true;
}

export async function ensureRestrictedEditorAccess(userId, phone) {
  if (!userId) return false;
  const normalizedPhone = String(phone || "").replace(/\D/g, "").slice(-10);
  if (normalizedPhone === FORMER_RESTRICTED_EDITOR_PHONE) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("DELETE FROM `user_roles` WHERE `user_id` = ?", userId);
      await tx.$executeRawUnsafe("DELETE FROM `user_permissions` WHERE `user_id` = ?", userId);
    });
    return false;
  }
  if (!isRestrictedEditorPhone(phone)) return false;

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
  const now = new Date();
  const ensureUser = async (tx, phone) => {
    const variants = [phone, `+91${phone}`];
    const rows = await tx.$queryRawUnsafe(
      "SELECT `id`,`phone` FROM `app_auth_users` WHERE `phone` IN (?,?) LIMIT 1",
      ...variants,
    );
    if (rows[0]) return rows[0];
    const id = randomUUID();
    await tx.app_auth_users.create({ data: { id, phone: `+91${phone}`, provider: "phone", user_metadata: {} } });
    return { id, phone: `+91${phone}` };
  };

  const users = await prisma.$transaction(async (tx) => {
    const former = await ensureUser(tx, FORMER_RESTRICTED_EDITOR_PHONE);
    const current = await ensureUser(tx, RESTRICTED_EDITOR_PHONE);
    const ensureProfilePhone = async (user, phone) => {
      const profile = await tx.profiles.findFirst({ where: { user_id: user.id } });
      if (profile) {
        await tx.profiles.update({ where: { id: profile.id }, data: { phone: `+91${phone}`, updated_at: now } });
      } else {
        await tx.profiles.create({ data: { id: user.id, user_id: user.id, phone: `+91${phone}`, created_at: now, updated_at: now } });
      }
    };

    await tx.$executeRawUnsafe("DELETE FROM `user_roles` WHERE `user_id` = ?", former.id);
    await tx.$executeRawUnsafe("DELETE FROM `user_permissions` WHERE `user_id` = ?", former.id);
    await ensureProfilePhone(former, FORMER_RESTRICTED_EDITOR_PHONE);
    await ensureProfilePhone(current, RESTRICTED_EDITOR_PHONE);
    await tx.$executeRawUnsafe(
      "UPDATE `team_invites` SET `phone` = ?, `updated_at` = ? WHERE `status` = 'pending' AND (`phone` = ? OR `phone` = ?)",
      RESTRICTED_EDITOR_PHONE, now, FORMER_RESTRICTED_EDITOR_PHONE, `+91${FORMER_RESTRICTED_EDITOR_PHONE}`,
    );
    return { former, current };
  });

  await ensureRestrictedEditorAccess(users.current.id, users.current.phone);
  return true;
}
