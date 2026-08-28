import { prisma } from "../src/db.mjs";
import { revokeUserSessionsByPhone } from "../src/auth.mjs";

const phone = process.env.REVOKE_PHONE || process.argv[2];

try {
  const result = await revokeUserSessionsByPhone(phone);
  const remaining = await prisma.app_auth_refresh_tokens.count({
    where: { user_id: result.user_id, revoked_at: null },
  });
  if (remaining !== 0) throw new Error(`Session revocation verification failed: ${remaining} active refresh tokens remain`);
  console.log(JSON.stringify({ ok: true, ...result, active_refresh_tokens: remaining }));
} finally {
  await prisma.$disconnect();
}
