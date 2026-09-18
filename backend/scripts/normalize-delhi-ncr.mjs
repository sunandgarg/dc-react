import { Prisma, PrismaClient } from "@prisma/client";
import "../src/database-url.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME must be configured");
  process.exit(1);
}

const prisma = new PrismaClient();

const matchingDelhiState = Prisma.sql`
  LOWER(TRIM(REPLACE(state, '-', ' '))) IN (
    'delhi',
    'new delhi',
    'nct of delhi',
    'delhi ncr'
  )
`;

try {
  const [beforeRow] = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM colleges
    WHERE ${matchingDelhiState}
  `;
  const updated = await prisma.$executeRaw`
    UPDATE colleges
    SET state = 'Delhi NCR'
    WHERE ${matchingDelhiState}
      AND BINARY state <> BINARY 'Delhi NCR'
  `;
  const [remainingRow] = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM colleges
    WHERE ${matchingDelhiState}
      AND BINARY state <> BINARY 'Delhi NCR'
  `;
  const matched = Number(beforeRow?.count || 0);
  const remaining = Number(remainingRow?.count || 0);

  if (remaining !== 0) throw new Error(`Delhi NCR normalization incomplete: ${remaining} college rows remain`);
  console.log(JSON.stringify({ table: "colleges", matched, updated, remaining }, null, 2));
} finally {
  await prisma.$disconnect();
}
