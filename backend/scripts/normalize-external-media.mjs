import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma, quote, schemaMetadata } from "../src/db.mjs";
import { normalizeExternalStorageValue } from "../src/media-normalizer.mjs";

const bucket = String(process.env.AWS_S3_BUCKET || "").trim();
const mediaBaseUrl = String(process.env.MEDIA_BASE_URL || "").replace(/\/$/, "");
if (!bucket || !mediaBaseUrl) throw new Error("AWS_S3_BUCKET and MEDIA_BASE_URL are required");

const client = new S3Client({ region: String(process.env.AWS_REGION || "ap-south-1") });
const objectCache = new Map();
const objectExists = async (key) => {
  if (objectCache.has(key)) return objectCache.get(key);
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    objectCache.set(key, true);
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") {
      objectCache.set(key, false);
      return false;
    }
    throw error;
  }
};

const report = { scannedFields: 0, matchingRows: 0, updatedRows: 0, references: 0, normalized: 0, missing: 0 };

try {
  for (const [table, metadata] of Object.entries(schemaMetadata)) {
    if (metadata.ignored || !metadata.primaryKeys?.length) continue;
    const fields = Object.entries(metadata.fields).filter(([, field]) => ["String", "Json"].includes(field.type));
    for (const [fieldName, field] of fields) {
      report.scannedFields += 1;
      const selected = [...metadata.primaryKeys, fieldName].map(quote).join(", ");
      const rows = await prisma.$queryRawUnsafe(
        `SELECT ${selected} FROM ${quote(table)} WHERE CAST(${quote(fieldName)} AS CHAR) LIKE ?`,
        "%/storage/v1/object/public/%",
      );
      report.matchingRows += rows.length;

      for (const row of rows) {
        let current = row[fieldName];
        if (field.type === "Json" && typeof current === "string") {
          try { current = JSON.parse(current); } catch { /* normalize the raw string */ }
        }
        const normalized = await normalizeExternalStorageValue(current, { mediaBaseUrl, objectExists });
        report.references += normalized.stats.references;
        report.normalized += normalized.stats.normalized;
        report.missing += normalized.stats.missing;
        if (normalized.stats.references === 0) continue;

        const storedValue = field.type === "Json" ? JSON.stringify(normalized.value) : normalized.value;
        const where = metadata.primaryKeys.map((primaryKey) => `${quote(primaryKey)} = ?`).join(" AND ");
        await prisma.$executeRawUnsafe(
          `UPDATE ${quote(table)} SET ${quote(fieldName)} = ? WHERE ${where}`,
          storedValue,
          ...metadata.primaryKeys.map((primaryKey) => row[primaryKey]),
        );
        report.updatedRows += 1;
      }
    }
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
