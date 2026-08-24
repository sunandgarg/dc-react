import { randomUUID } from "node:crypto";
import { prisma } from "./db.mjs";
import { dispatchLead } from "./lead-automation.mjs";

const positiveNumber = (value, fallback, minimum) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
};
const POLL_MS = positiveNumber(process.env.LEAD_OUTBOX_POLL_MS, 5_000, 1_000);
const LOCK_TIMEOUT_SECONDS = positiveNumber(process.env.LEAD_OUTBOX_LOCK_TIMEOUT_SECONDS, 180, 60);
const MAX_ATTEMPTS = positiveNumber(process.env.LEAD_OUTBOX_MAX_ATTEMPTS, 8, 1);
const workerId = `${process.env.HOSTNAME || "node"}:${process.pid}:${randomUUID()}`;
let timer = null;
let running = false;

export function retryDelayMs(attempts) {
  return Math.min(60 * 60_000, 15_000 * (2 ** Math.max(0, Number(attempts || 1) - 1)));
}

export async function ensureLeadOutbox() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`lead_automation_outbox\` (
      \`id\` CHAR(36) NOT NULL,
      \`lead_id\` CHAR(36) NOT NULL,
      \`status\` VARCHAR(20) NOT NULL DEFAULT 'pending',
      \`attempts\` INT NOT NULL DEFAULT 0,
      \`available_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`locked_at\` DATETIME(3) NULL,
      \`worker_id\` VARCHAR(191) NULL,
      \`last_error\` LONGTEXT NULL,
      \`completed_at\` DATETIME(3) NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`lead_automation_outbox_lead_id_key\` (\`lead_id\`),
      KEY \`lead_automation_outbox_poll_idx\` (\`status\`, \`available_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await recoverStaleJobs();
}

async function recoverStaleJobs() {
  await prisma.$executeRawUnsafe(
    `UPDATE \`lead_automation_outbox\`
       SET \`status\`='pending', \`worker_id\`=NULL, \`locked_at\`=NULL, \`available_at\`=NOW(3)
     WHERE \`status\`='processing' AND \`locked_at\` < DATE_SUB(NOW(3), INTERVAL ${LOCK_TIMEOUT_SECONDS} SECOND)`,
  );
}

export async function enqueueLeadAutomation(db, leadId) {
  await db.$executeRawUnsafe(
    `INSERT INTO \`lead_automation_outbox\` (\`id\`,\`lead_id\`,\`status\`,\`attempts\`,\`available_at\`,\`created_at\`,\`updated_at\`)
     VALUES (?,?, 'pending',0,NOW(3),NOW(3),NOW(3))
     ON DUPLICATE KEY UPDATE
       \`status\`=IF(\`status\` IN ('completed','processing'),\`status\`,'pending'),
       \`available_at\`=IF(\`status\` IN ('completed','processing'),\`available_at\`,NOW(3)),
       \`updated_at\`=NOW(3)`,
    randomUUID(), leadId,
  );
}

async function claimJob() {
  await prisma.$executeRawUnsafe(
    `UPDATE \`lead_automation_outbox\`
       SET \`status\`='processing', \`worker_id\`=?, \`locked_at\`=NOW(3), \`attempts\`=\`attempts\`+1
     WHERE \`id\`=(
       SELECT \`id\` FROM (
         SELECT \`id\` FROM \`lead_automation_outbox\`
          WHERE \`status\`='pending' AND \`available_at\` <= NOW(3)
          ORDER BY \`available_at\`, \`created_at\` LIMIT 1
       ) AS \`claimable\`
     ) AND \`status\`='pending'`,
    workerId,
  );
  const rows = await prisma.$queryRawUnsafe(
    "SELECT `id`,`lead_id`,`attempts` FROM `lead_automation_outbox` WHERE `status`='processing' AND `worker_id`=? ORDER BY `locked_at` DESC LIMIT 1",
    workerId,
  );
  return rows[0] || null;
}

async function finishJob(job) {
  await prisma.$executeRawUnsafe(
    "UPDATE `lead_automation_outbox` SET `status`='completed',`completed_at`=NOW(3),`worker_id`=NULL,`locked_at`=NULL,`last_error`=NULL WHERE `id`=? AND `worker_id`=?",
    job.id, workerId,
  );
}

async function retryJob(job, cause) {
  const attempts = Number(job.attempts || 1);
  const status = attempts >= MAX_ATTEMPTS ? "dead" : "pending";
  const availableAt = new Date(Date.now() + retryDelayMs(attempts));
  await prisma.$executeRawUnsafe(
    "UPDATE `lead_automation_outbox` SET `status`=?,`available_at`=?,`worker_id`=NULL,`locked_at`=NULL,`last_error`=? WHERE `id`=? AND `worker_id`=?",
    status, availableAt, String(cause).slice(0, 50_000), job.id, workerId,
  );
}

export async function processLeadOutboxOnce() {
  const job = await claimJob();
  if (!job) return false;
  try {
    await dispatchLead(job.lead_id);
    await finishJob(job);
  } catch (cause) {
    await retryJob(job, cause);
  }
  return true;
}

async function poll() {
  if (running) return;
  running = true;
  try {
    await recoverStaleJobs();
    while (await processLeadOutboxOnce()) { /* drain currently available jobs */ }
  } catch (cause) {
    console.error("lead outbox poll failed", cause);
  } finally {
    running = false;
  }
}

export async function startLeadOutboxWorker() {
  await ensureLeadOutbox();
  await poll();
  timer = setInterval(poll, POLL_MS);
  timer.unref();
}

export function stopLeadOutboxWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
