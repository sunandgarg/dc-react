#!/usr/bin/env node

import { prisma } from "../src/db.mjs";
import { CONTENT_HEAD_PHONE, CONTENT_HEAD_RESOURCES, provisionExistingContentHead } from "../src/editor-access.mjs";

const REMOVED_PHONE = "7428966263";
const removedVariants = [REMOVED_PHONE, `+91${REMOVED_PHONE}`];

try {
  const removedUsers = await prisma.app_auth_users.findMany({
    where: { phone: { in: removedVariants } },
    select: { id: true },
  });
  const removedIds = removedUsers.map((user) => user.id);
  const deletion = await prisma.$transaction(async (tx) => {
    const invites = await tx.team_invites.deleteMany({
      where: {
        OR: [
          { phone: { in: removedVariants } },
          ...(removedIds.length ? [{ accepted_user_id: { in: removedIds } }] : []),
        ],
      },
    });
    const permissions = removedIds.length
      ? await tx.user_permissions.deleteMany({ where: { user_id: { in: removedIds } } })
      : { count: 0 };
    const roles = removedIds.length
      ? await tx.user_roles.deleteMany({ where: { user_id: { in: removedIds } } })
      : { count: 0 };
    const profiles = await tx.profiles.deleteMany({
      where: {
        OR: [
          { phone: { in: removedVariants } },
          ...(removedIds.length ? [{ user_id: { in: removedIds } }] : []),
        ],
      },
    });
    const refreshTokens = removedIds.length
      ? await tx.app_auth_refresh_tokens.deleteMany({ where: { user_id: { in: removedIds } } })
      : { count: 0 };
    const otps = await tx.app_auth_otps.deleteMany({ where: { phone: { in: removedVariants } } });
    const users = removedIds.length
      ? await tx.app_auth_users.deleteMany({ where: { id: { in: removedIds } } })
      : { count: 0 };
    return {
      users: users.count, profiles: profiles.count, roles: roles.count,
      permissions: permissions.count, refresh_tokens: refreshTokens.count,
      otps: otps.count, invites: invites.count,
    };
  });

  const contentHead = await provisionExistingContentHead();
  const [
    remainingRemovedUsers,
    remainingRemovedProfiles,
    remainingRemovedInvites,
    remainingRemovedOtps,
    remainingRemovedRoles,
    remainingRemovedPermissions,
    remainingRemovedRefreshTokens,
    roleRows,
    permissionRows,
  ] = await Promise.all([
    prisma.app_auth_users.count({ where: { phone: { in: removedVariants } } }),
    prisma.profiles.count({
      where: {
        OR: [
          { phone: { in: removedVariants } },
          ...(removedIds.length ? [{ user_id: { in: removedIds } }] : []),
        ],
      },
    }),
    prisma.team_invites.count({
      where: {
        OR: [
          { phone: { in: removedVariants } },
          ...(removedIds.length ? [{ accepted_user_id: { in: removedIds } }] : []),
        ],
      },
    }),
    prisma.app_auth_otps.count({ where: { phone: { in: removedVariants } } }),
    removedIds.length ? prisma.user_roles.count({ where: { user_id: { in: removedIds } } }) : 0,
    removedIds.length ? prisma.user_permissions.count({ where: { user_id: { in: removedIds } } }) : 0,
    removedIds.length ? prisma.app_auth_refresh_tokens.count({ where: { user_id: { in: removedIds } } }) : 0,
    prisma.user_roles.findMany({ where: { user_id: contentHead.id } }),
    prisma.user_permissions.findMany({ where: { user_id: contentHead.id } }),
  ]);
  if (
    remainingRemovedUsers || remainingRemovedProfiles || remainingRemovedInvites
    || remainingRemovedOtps || remainingRemovedRoles || remainingRemovedPermissions
    || remainingRemovedRefreshTokens
  ) {
    throw new Error("Removed user still has identity, access, invite, OTP, or login-session records after reconciliation");
  }
  if (roleRows.length !== 1 || roleRows[0].role !== "content_head") throw new Error("Content Head role verification failed");
  if (permissionRows.length !== CONTENT_HEAD_RESOURCES.size) throw new Error("Content Head permission-count verification failed");
  for (const resource of CONTENT_HEAD_RESOURCES) {
    const permission = permissionRows.find((row) => row.resource === resource);
    if (!permission?.can_view || !permission?.can_create || !permission?.can_edit || !permission?.can_publish || permission.can_delete) {
      throw new Error(`${resource} Content Head permission verification failed`);
    }
  }
  console.log(JSON.stringify({
    ok: true,
    removed_phone: REMOVED_PHONE,
    deletion,
    content_head_phone: CONTENT_HEAD_PHONE,
    content_head_user_id: contentHead.id,
    permissions: [...CONTENT_HEAD_RESOURCES],
    can_delete: false,
  }));
} finally {
  await prisma.$disconnect();
}
