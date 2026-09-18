import { PrismaClient } from "@prisma/client";
import "../src/database-url.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME must be configured");
  process.exit(1);
}

const prisma = new PrismaClient();
const DELHI_ALIASES = [
  "Delhi", "delhi", "DELHI",
  "New Delhi", "new delhi",
  "NCT of Delhi", "nct of delhi",
  "Delhi-NCR", "delhi-ncr",
  "Delhi NCR", "delhi ncr",
];

try {
  const before = await prisma.colleges.count({ where: { state: { in: DELHI_ALIASES } } });
  const affected = await prisma.colleges.updateMany({
    where: { state: { in: DELHI_ALIASES.filter((value) => value !== "Delhi NCR") } },
    data: { state: "Delhi NCR" },
  });
  const remaining = await prisma.colleges.count({
    where: { state: { in: DELHI_ALIASES.filter((value) => value !== "Delhi NCR") } },
  });

  if (remaining !== 0) throw new Error(`Delhi NCR normalization incomplete: ${remaining} college rows remain`);
  console.log(JSON.stringify({ table: "colleges", matched: before, updated: affected.count, remaining }, null, 2));
} finally {
  await prisma.$disconnect();
}
