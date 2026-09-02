import { randomUUID } from "node:crypto";
import {
  GetAccountCommand,
  GetEmailIdentityCommand,
  SendEmailCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { prisma } from "./db.mjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function cleanHeader(value, maxLength) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

function optionalEmail(value, label) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return null;
  if (!EMAIL_PATTERN.test(email)) throw httpError(400, "INVALID_EMAIL", `${label} is not a valid email address`);
  return email;
}

export function sesRuntimeConfig() {
  return {
    enabled: String(process.env.SES_ENABLED || "").toLowerCase() === "true",
    region: String(process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1").trim(),
    identity: String(process.env.SES_IDENTITY || "dekhocampus.com").trim().toLowerCase(),
    fromEmail: String(process.env.SES_FROM_EMAIL || "noreply@dekhocampus.com").trim().toLowerCase(),
    fromName: cleanHeader(process.env.SES_FROM_NAME || "DekhoCampus", 120),
  };
}

export function normalizeEmailRequest(input = {}) {
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const recipients = [...new Set(to.map((value) => optionalEmail(value, "Recipient")).filter(Boolean))];
  if (!recipients.length) throw httpError(400, "RECIPIENT_REQUIRED", "At least one recipient is required");
  if (recipients.length > 10) throw httpError(400, "TOO_MANY_RECIPIENTS", "A maximum of 10 recipients is allowed per message");

  const subject = cleanHeader(input.subject, 200);
  const text = String(input.text || "").trim();
  const html = String(input.html || "").trim();
  if (!subject) throw httpError(400, "SUBJECT_REQUIRED", "Email subject is required");
  if (!text && !html) throw httpError(400, "BODY_REQUIRED", "Email text or HTML content is required");
  if (text.length > 500_000 || html.length > 1_000_000) throw httpError(413, "EMAIL_TOO_LARGE", "Email content is too large");

  return { recipients, subject, text, html };
}

export function buildSesMessage(message, provider, runtime = sesRuntimeConfig()) {
  const fromEmail = optionalEmail(provider?.from_email || runtime.fromEmail, "From email");
  const fromName = cleanHeader(provider?.from_name || runtime.fromName, 120);
  const replyTo = optionalEmail(provider?.reply_to, "Reply-To");
  const body = {};
  if (message.text) body.Text = { Data: message.text, Charset: "UTF-8" };
  if (message.html) body.Html = { Data: message.html, Charset: "UTF-8" };

  return {
    FromEmailAddress: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
    Destination: { ToAddresses: message.recipients },
    Content: {
      Simple: {
        Subject: { Data: message.subject, Charset: "UTF-8" },
        Body: body,
      },
    },
    ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
  };
}

async function activeSesProvider() {
  return prisma.email_providers.findFirst({
    where: { provider_name: "aws_ses", is_active: true },
    orderBy: { updated_at: "desc" },
  });
}

function sesClient(region) {
  return new SESv2Client({ region });
}

export async function getSesStatus() {
  const runtime = sesRuntimeConfig();
  const provider = await prisma.email_providers.findFirst({
    where: { provider_name: "aws_ses" },
    orderBy: { updated_at: "desc" },
  });
  const base = {
    configured: runtime.enabled,
    credential_source: "iam_runtime",
    region: runtime.region,
    identity: runtime.identity,
    from_email: provider?.from_email || runtime.fromEmail,
    from_name: provider?.from_name || runtime.fromName,
    reply_to: provider?.reply_to || null,
    active: Boolean(provider?.is_active),
  };
  if (!runtime.enabled) return { ...base, available: false, message: "SES is disabled in the server runtime" };

  try {
    const client = sesClient(runtime.region);
    const [account, identity] = await Promise.all([
      client.send(new GetAccountCommand({})),
      client.send(new GetEmailIdentityCommand({ EmailIdentity: runtime.identity })),
    ]);
    return {
      ...base,
      available: true,
      production_access: Boolean(account.ProductionAccessEnabled),
      sending_enabled: Boolean(account.SendingEnabled),
      sent_last_24_hours: Number(account.SendQuota?.SentLast24Hours || 0),
      max_24_hour_send: Number(account.SendQuota?.Max24HourSend || 0),
      max_send_rate: Number(account.SendQuota?.MaxSendRate || 0),
      verification_status: identity.VerificationStatus || "UNKNOWN",
      verified_for_sending: Boolean(identity.VerifiedForSendingStatus),
      dkim_status: identity.DkimAttributes?.Status || "UNKNOWN",
      dkim_signing_enabled: Boolean(identity.DkimAttributes?.SigningEnabled),
    };
  } catch (error) {
    return {
      ...base,
      available: false,
      code: error?.name || "SES_STATUS_FAILED",
      message: error instanceof Error ? error.message : "Unable to read Amazon SES status",
    };
  }
}

export async function sendTransactionalEmail(input, meta = {}) {
  const runtime = sesRuntimeConfig();
  if (!runtime.enabled) throw httpError(503, "SES_DISABLED", "Amazon SES is not enabled on this server");

  const provider = await activeSesProvider();
  if (!provider) throw httpError(503, "EMAIL_PROVIDER_INACTIVE", "Amazon SES is not active in Admin integrations");
  const message = normalizeEmailRequest(input);
  const request = buildSesMessage(message, provider, runtime);
  const logMeta = {
    purpose: cleanHeader(meta.purpose || "transactional", 80),
    actor_user_id: meta.actorUserId || null,
    recipient_count: message.recipients.length,
    credential_source: "iam_runtime",
    region: runtime.region,
  };

  try {
    const result = await sesClient(runtime.region).send(new SendEmailCommand(request));
    await prisma.email_log.create({
      data: {
        id: randomUUID(),
        provider_name: "aws_ses",
        to_email: message.recipients.join(","),
        subject: message.subject,
        status: "sent",
        message_id: result.MessageId || null,
        error: null,
        meta: logMeta,
      },
    });
    return { sent: true, message_id: result.MessageId || null };
  } catch (error) {
    await prisma.email_log.create({
      data: {
        id: randomUUID(),
        provider_name: "aws_ses",
        to_email: message.recipients.join(","),
        subject: message.subject,
        status: "failed",
        message_id: null,
        error: cleanHeader(error instanceof Error ? error.message : "SES send failed", 2_000),
        meta: logMeta,
      },
    }).catch(() => undefined);
    throw httpError(502, error?.name || "SES_SEND_FAILED", error instanceof Error ? error.message : "Amazon SES could not send the email");
  }
}

export async function handleEmailAdmin(request, actorUserId) {
  const body = await request.json().catch(() => ({}));
  if (body.action === "status") return getSesStatus();
  if (body.action && body.action !== "send_test") throw httpError(400, "INVALID_ACTION", "Unsupported email action");
  return sendTransactionalEmail({
    to: body.to,
    subject: body.subject || "DekhoCampus Amazon SES test",
    text: body.text || "Amazon SES is connected to the DekhoCampus AWS backend.",
    html: body.html,
  }, { purpose: "admin_test", actorUserId });
}
