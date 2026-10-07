import { randomUUID } from "node:crypto";

const ENTITY_TYPES = new Set([
  "college", "course", "exam", "career", "scholarship", "article", "study_subject", "study_chapter",
]);

export function normalizeArticleEntityLinks(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) {
    throw Object.assign(new Error("Choose at most 100 article links"), { status: 400, code: "INVALID_ARTICLE_LINKS" });
  }
  const seen = new Set();
  return value.map((item) => {
    const entity_type = String(item?.entity_type || "");
    const entity_slug = String(item?.entity_slug || "").trim();
    if (!ENTITY_TYPES.has(entity_type) || !entity_slug || entity_slug.length > 255) {
      throw Object.assign(new Error("Article links must reference a valid entity type and slug"), { status: 400, code: "INVALID_ARTICLE_LINKS" });
    }
    return { entity_type, entity_slug };
  }).filter((item) => {
    const key = `${item.entity_type}:${item.entity_slug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function saveNewArticleEntityLinks(tx, article) {
  const links = normalizeArticleEntityLinks(article.entity_links);
  if (!links?.length) return;
  for (const link of links) {
    await tx.$executeRawUnsafe(
      "INSERT INTO `article_links` (`id`, `article_id`, `entity_type`, `entity_slug`, `created_at`) VALUES (?,?,?,?,?)",
      randomUUID(), article.id, link.entity_type, link.entity_slug, new Date(),
    );
  }
}

export async function replaceArticleEntityLinks(tx, article) {
  const links = normalizeArticleEntityLinks(article.entity_links);
  if (links === undefined) return;
  const types = [...ENTITY_TYPES];
  const existing = await tx.$queryRawUnsafe(
    `SELECT \`id\`, \`entity_type\`, \`entity_slug\` FROM \`article_links\` WHERE \`article_id\` = ? AND \`entity_type\` IN (${types.map(() => "?").join(",")})`,
    article.id, ...types,
  );
  const selected = new Set(links.map(({ entity_type, entity_slug }) => `${entity_type}:${entity_slug}`));
  const saved = new Set(existing.map(({ entity_type, entity_slug }) => `${entity_type}:${entity_slug}`));
  for (const row of existing) {
    if (!selected.has(`${row.entity_type}:${row.entity_slug}`)) {
      await tx.$executeRawUnsafe("DELETE FROM `article_links` WHERE `id` = ?", row.id);
    }
  }
  for (const link of links) {
    if (!saved.has(`${link.entity_type}:${link.entity_slug}`)) {
      await tx.$executeRawUnsafe(
        "INSERT INTO `article_links` (`id`, `article_id`, `entity_type`, `entity_slug`, `created_at`) VALUES (?,?,?,?,?)",
        randomUUID(), article.id, link.entity_type, link.entity_slug, new Date(),
      );
    }
  }
}
