import { quote } from "./db.mjs";

export const searchFields = {
  colleges: ["name", "slug", "short_name", "city", "state"],
  courses: ["name", "slug", "full_name"],
  exams: ["name", "slug", "short_name", "full_name"],
  articles: ["title", "slug", "description", "category", "vertical", "site_scope"],
};
export const searchColumns = [...new Set(Object.values(searchFields).flat())];

export async function ensureEntitySearchIndex(db) {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS entity_search_names (
    entity_table VARCHAR(16) NOT NULL, id CHAR(36) NOT NULL,
    ${searchColumns.map(field => `${quote(field)} LONGTEXT NULL`).join(",")},
    PRIMARY KEY(entity_table,id)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  for (const [table, fields] of Object.entries(searchFields)) {
    const columns = ["entity_table", "id", ...fields].map(quote).join(",");
    const values = [`'${table}'`, "NEW.id", ...fields.map(field => `NEW.${quote(field)}`)].join(",");
    const updates = fields.map(field => `${quote(field)}=VALUES(${quote(field)})`).join(",");
    // Triggers keep imports and writes through every existing entry point in sync.
    for (const event of ["INSERT", "UPDATE", "DELETE"]) {
      const name = `dc_search_${table}_${event.toLowerCase()}`;
      const existing = await db.$queryRawUnsafe("SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?", name);
      if (existing.length) continue;
      const action = event === "DELETE"
        ? `DELETE FROM entity_search_names WHERE entity_table='${table}' AND id=OLD.id`
        : `INSERT INTO entity_search_names (${columns}) VALUES (${values}) ON DUPLICATE KEY UPDATE ${updates}`;
      await db.$executeRawUnsafe(`CREATE TRIGGER ${quote(name)} AFTER ${event} ON ${quote(table)} FOR EACH ROW ${action}`);
    }
    const marker = await db.$queryRawUnsafe("SELECT 1 FROM entity_search_names WHERE entity_table='_ready' AND id=? LIMIT 1", table);
    if (!marker.length) {
      await db.$executeRawUnsafe(`INSERT INTO entity_search_names (${columns}) SELECT '${table}',id,${fields.map(quote).join(",")} FROM ${quote(table)} ON DUPLICATE KEY UPDATE ${updates}`);
      await db.$executeRawUnsafe("INSERT INTO entity_search_names (entity_table,id) VALUES ('_ready',?)", table);
    }
  }
}

export function searchFilterSource(table, field) {
  return searchFields[table]?.includes(field)
    ? `SELECT id FROM entity_search_names WHERE entity_table='${table}' AND `
    : null;
}
