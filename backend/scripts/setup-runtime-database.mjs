import { spawnSync } from "node:child_process";
import "../src/database-url.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME must be configured");
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(process.execPath, ["./node_modules/prisma/build/index.js", "db", "push"]);
run(process.execPath, ["scripts/apply-mysql-parity.mjs"]);
