import { randomUUID } from "node:crypto";
import { prisma } from "./db.mjs";

export const CONTENT_HEAD_PHONE = "8810323087";
export const CONTENT_HEAD_RESOURCES = new Set(["articles", "colleges", "courses", "exams"]);

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

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

export function isContentHeadPhone(phone) {
  return normalizePhone(phone) === CONTENT_HEAD_PHONE;
}

export function canContentEditorAccess(resource, action) {
  return CONTENT_EDITOR_RESOURCES.has(String(resource || ""))
    && ["view", "create", "edit"].includes(String(action || ""));
}

export function canContentHeadAccess(resource, action) {
  return CONTENT_HEAD_RESOURCES.has(String(resource || ""))
    && ["view", "create", "edit"].includes(String(action || ""));
}

async function replaceContentHeadAccess(tx, userId) {
  await tx.$executeRawUnsafe("DELETE FROM `user_roles` WHERE `user_id` = ?", userId);
  await tx.$executeRawUnsafe("DELETE FROM `user_permissions` WHERE `user_id` = ?", userId);
  await tx.user_roles.create({
    data: { id: randomUUID(), user_id: userId, role: "content_head" },
  });
  const now = new Date();
  for (const resource of CONTENT_HEAD_RESOURCES) {
    await tx.user_permissions.create({
      data: {
        id: randomUUID(), user_id: userId, module: resource, action: "view",
        allow: true, resource, scope: "all", can_view: true, can_create: true,
        can_edit: true, can_delete: false, can_publish: true,
        created_at: now, updated_at: now,
      },
    });
  }
}

export async function acceptPendingTeamInvite(user) {
  const phone = normalizePhone(user?.phone);
  if (!user?.id || !phone) return false;
  const invite = await prisma.team_invites.findFirst({
    where: { status: "pending", OR: [{ phone }, { phone: `+91${phone}` }] },
    orderBy: { created_at: "desc" },
  });
  if (!invite) return false;

  await prisma.$transaction(async (tx) => {
    if (invite.role === "content_head") {
      await replaceContentHeadAccess(tx, user.id);
    } else {
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

export async function ensureContentHeadAccess(userId, phone) {
  if (!userId || !isContentHeadPhone(phone)) return false;
  await prisma.$transaction((tx) => replaceContentHeadAccess(tx, userId));
  return true;
}

export async function provisionExistingContentHead() {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const variants = [CONTENT_HEAD_PHONE, `+91${CONTENT_HEAD_PHONE}`];
    let user = await tx.app_auth_users.findFirst({ where: { phone: { in: variants } } });
    if (!user) {
      user = await tx.app_auth_users.create({
        data: {
          id: randomUUID(), phone: `+91${CONTENT_HEAD_PHONE}`, provider: "phone",
          user_metadata: { full_name: "Content Head" },
        },
      });
    }
    const profile = await tx.profiles.findFirst({ where: { user_id: user.id } });
    if (profile) {
      await tx.profiles.update({
        where: { id: profile.id },
        data: {
          phone: `+91${CONTENT_HEAD_PHONE}`,
          ...(profile.display_name ? {} : { display_name: "Content Head" }),
          updated_at: now,
        },
      });
    } else {
      await tx.profiles.create({
        data: {
          id: user.id, user_id: user.id, phone: `+91${CONTENT_HEAD_PHONE}`,
          display_name: "Content Head", created_at: now, updated_at: now,
        },
      });
    }
    await replaceContentHeadAccess(tx, user.id);
    return user;
  });
}
