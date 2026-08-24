import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "./db.mjs";

const ACCESS_TTL_SECONDS = Number(process.env.AUTH_ACCESS_TTL_SECONDS || 3600);
const REFRESH_TTL_SECONDS = Number(process.env.AUTH_REFRESH_TTL_SECONDS || 60 * 60 * 24 * 180);
const OWNER_ADMIN_PHONES = new Set(["8700602524", "9990109393"]);

export function isOwnerAdminPhone(phone) {
  return OWNER_ADMIN_PHONES.has(String(phone || "").replace(/\D/g, "").slice(-10));
}

function secret() {
  const value = process.env.AUTH_JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dc-local-development-secret-change-me");
  if (value.length < 32) throw Object.assign(new Error("AUTH_JWT_SECRET must contain at least 32 characters"), { status: 503, code: "AUTH_NOT_CONFIGURED" });
  return value;
}

const base64url = (value) => Buffer.from(value).toString("base64url");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const otpDigest = (phone, otp) => createHmac("sha256", secret()).update(`${phone}:${otp}`).digest("hex");

function signJwt(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret()).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(token) {
  const [header, body, signature] = String(token || "").split(".");
  if (!header || !body || !signature) return null;
  const expected = createHmac("sha256", secret()).update(`${header}.${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp <= Math.floor(Date.now() / 1000) || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

function authUser(row) {
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email || undefined,
    phone: row.phone || undefined,
    app_metadata: { provider: row.provider || "phone", providers: [row.provider || "phone"] },
    user_metadata: typeof row.user_metadata === "string" ? JSON.parse(row.user_metadata || "{}") : (row.user_metadata || {}),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

async function issueSession(userRow) {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({ sub: userRow.id, aud: "authenticated", role: "authenticated", iat: now, exp: now + ACCESS_TTL_SECONDS });
  const refreshToken = randomBytes(48).toString("base64url");
  await prisma.app_auth_refresh_tokens.create({
    data: { id: randomUUID(), user_id: userRow.id, token_hash: digest(refreshToken), expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000) },
  });
  return { access_token: accessToken, token_type: "bearer", expires_in: ACCESS_TTL_SECONDS, expires_at: now + ACCESS_TTL_SECONDS, refresh_token: refreshToken, user: authUser(userRow) };
}

async function userFromRequest(request) {
  const value = request.headers.get("authorization") || "";
  const token = value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  return prisma.app_auth_users.findUnique({ where: { id: payload.sub } });
}

function providerConfig(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value;
}

function fast2SmsError(text, fallback) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === "string") return parsed.message;
    if (typeof parsed?.message?.description === "string") return parsed.message.description;
  } catch {}
  return fallback;
}

async function sendFast2SmsOtp(phone, otp) {
  const provider = await prisma.otp_providers.findFirst({
    where: { provider_name: "fast2sms", channel: "sms", is_active: true },
  });
  const apiKey = String(process.env.SMS_FAST2SMS_API_KEY || "").trim();
  if (!provider || !apiKey) return false;

  const config = providerConfig(provider.config_json);
  const mobile = phone.replace(/^\+91/, "");
  const templateId = String(provider.template_id || config.otp_id || "").trim();
  if (!/^\d{10}$/.test(mobile) || !templateId) {
    throw Object.assign(new Error("Fast2SMS configuration is incomplete"), { status: 503, code: "SMS_NOT_CONFIGURED" });
  }

  const response = await fetch(`${String(provider.base_url || "https://www.fast2sms.com").replace(/\/$/, "")}/dev/otp/send`, {
    method: "POST",
    headers: { authorization: apiKey, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      mobile,
      otp_id: templateId,
      otp,
      otp_expiry: Math.min(1440, Math.max(1, Number(config.otp_expiry_minutes || 10))),
      otp_length: Math.min(10, Math.max(4, Number(config.otp_length || otp.length))),
      ...(Array.isArray(config.otp_variables_values) && config.otp_variables_values.length
        ? { variables_values: config.otp_variables_values.join("|") }
        : {}),
    }),
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (!response.ok || parsed?.return !== true) {
    throw Object.assign(new Error(fast2SmsError(text, "Fast2SMS rejected the OTP request")), { status: 502, code: "SMS_DELIVERY_FAILED" });
  }
  return true;
}

export async function resolveNativeIdentity(request) {
  const user = await userFromRequest(request);
  return user ? authUser(user) : null;
}

export async function sendPhoneOtp(request) {
  const body = await request.json().catch(() => ({}));
  const phone = String(body.phone || "").replace(/\s+/g, "");
  if (!/^\+91[6-9]\d{9}$/.test(phone)) throw Object.assign(new Error("Enter a valid Indian mobile number"), { status: 400, code: "INVALID_PHONE" });
  const recent = await prisma.app_auth_otps.findFirst({ where: { phone, created_at: { gt: new Date(Date.now() - 45_000) } }, orderBy: { created_at: "desc" } });
  if (recent) throw Object.assign(new Error("Please wait before requesting another OTP"), { status: 429, code: "OTP_RATE_LIMIT" });
  const otp = String(randomInt(100000, 1000000));
  const webhook = String(process.env.SMS_WEBHOOK_URL || "").trim();
  if (webhook) {
    const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json", ...(process.env.SMS_WEBHOOK_BEARER_TOKEN ? { authorization: `Bearer ${process.env.SMS_WEBHOOK_BEARER_TOKEN}` } : {}) }, body: JSON.stringify({ phone, message: `Your DekhoCampus verification code is ${otp}. It expires in 10 minutes.` }) });
    if (!response.ok) throw Object.assign(new Error("SMS provider rejected the OTP request"), { status: 502, code: "SMS_DELIVERY_FAILED" });
  } else if (await sendFast2SmsOtp(phone, otp)) {
    // The active provider configuration lives in MySQL; the API credential is injected from Secrets Manager.
  } else if (process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("SMS provider is not configured"), { status: 503, code: "SMS_NOT_CONFIGURED" });
  }
  await prisma.app_auth_otps.create({ data: { id: randomUUID(), phone, otp_hash: otpDigest(phone, otp), expires_at: new Date(Date.now() + 10 * 60_000) } });
  return { success: true, ...(process.env.NODE_ENV === "production" ? {} : { development_otp: otp }) };
}

export async function verifyPhoneOtp(request) {
  const body = await request.json().catch(() => ({}));
  const phone = String(body.phone || "").replace(/\s+/g, "");
  const otp = String(body.otp || "");
  const challenge = await prisma.app_auth_otps.findFirst({ where: { phone, consumed_at: null, expires_at: { gt: new Date() } }, orderBy: { created_at: "desc" } });
  if (!challenge || challenge.attempts >= 5 || challenge.otp_hash !== otpDigest(phone, otp)) {
    if (challenge) await prisma.app_auth_otps.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    throw Object.assign(new Error("Invalid or expired OTP"), { status: 401, code: "INVALID_OTP" });
  }
  await prisma.app_auth_otps.update({ where: { id: challenge.id }, data: { consumed_at: new Date() } });
  let user = await prisma.app_auth_users.findUnique({ where: { phone } });
  if (!user) user = await prisma.app_auth_users.create({ data: { id: randomUUID(), phone, provider: "phone", user_metadata: {} } });
  await prisma.$executeRawUnsafe("INSERT INTO `profiles` (`id`,`user_id`,`phone`,`created_at`,`updated_at`) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `phone`=VALUES(`phone`),`updated_at`=VALUES(`updated_at`)", user.id, user.id, phone, new Date(), new Date());
  if (isOwnerAdminPhone(phone)) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO `user_roles` (`id`,`user_id`,`role`,`created_at`) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE `role`=VALUES(`role`)",
      randomUUID(), user.id, "admin", new Date(),
    );
  }
  return { session: await issueSession(user), user: authUser(user) };
}

export async function handleAuth(request) {
  const url = new URL(request.url);
  if (url.pathname === "/auth/v1/settings" && request.method === "GET") return { status: 200, body: { disable_signup: false, external: { google: Boolean(process.env.GOOGLE_CLIENT_ID) }, phone: true } };
  if (url.pathname === "/auth/v1/user" && request.method === "GET") {
    const user = await userFromRequest(request);
    if (!user) return { status: 401, body: { code: "bad_jwt", msg: "Invalid session" } };
    return { status: 200, body: authUser(user) };
  }
  if (url.pathname === "/auth/v1/logout" && request.method === "POST") {
    const user = await userFromRequest(request);
    if (user) {
      await prisma.app_auth_refresh_tokens.updateMany({
        where: { user_id: user.id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
    return { status: 204, body: null };
  }
  if (url.pathname === "/auth/v1/token" && request.method === "POST" && url.searchParams.get("grant_type") === "refresh_token") {
    const body = await request.json().catch(() => ({}));
    const row = await prisma.app_auth_refresh_tokens.findUnique({ where: { token_hash: digest(String(body.refresh_token || "")) } });
    if (!row || row.revoked_at || row.expires_at <= new Date()) return { status: 401, body: { code: "refresh_token_not_found", msg: "Invalid refresh token" } };
    await prisma.app_auth_refresh_tokens.update({ where: { id: row.id }, data: { revoked_at: new Date() } });
    const user = await prisma.app_auth_users.findUnique({ where: { id: row.user_id } });
    return { status: 200, body: await issueSession(user) };
  }
  if (url.pathname === "/auth/v1/authorize") return { status: 501, body: { code: "OAUTH_NOT_CONFIGURED", msg: "Native Google OAuth needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" } };
  return null;
}
