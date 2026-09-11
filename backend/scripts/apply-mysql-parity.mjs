#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const metadata = JSON.parse(await readFile(new URL("../prisma/schema-metadata.json", import.meta.url), "utf8"));
const postgresSchemaReference = await readFile(new URL("../../db-export/full_schema.sql", import.meta.url), "utf8").catch(() => "");
const prisma = new PrismaClient();

async function createMysqlConnection() {
  const url = new URL(process.env.DATABASE_URL);
  const caFile = process.env.DB_SSL_CA || url.searchParams.get("sslcert");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslaccept");

  if (!caFile) return mysql.createConnection(url.toString());

  const ca = await readFile(new URL(`../prisma/${caFile}`, import.meta.url), "utf8");
  return mysql.createConnection({
    uri: url.toString(),
    ssl: {
      ca,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
  });
}

const mysqlConnection = await createMysqlConnection();
const quote = (identifier) => `\`${String(identifier).replaceAll("`", "``")}\``;

// Unique constraints recovered from the checked-in PostgreSQL migrations.
// Partial PostgreSQL indexes are intentionally excluded because their semantics
// cannot be represented by a normal MySQL unique index.
const uniqueIndexes = [
  ["user_sessions", "session_id"], ["approval_bodies", "code"], ["college_programs", "slug"],
  ["articles", "site_scope", "slug"], ["ai_providers", "provider_name"], ["legal_pages", "slug"],
  ["career_profiles", "slug"], ["companies", "name"], ["facilities_library", "name"],
  ["college_contacts", "college_slug"], ["study_boards", "slug"],
  ["study_subjects", "class_num", "board_slug", "slug"], ["study_chapters", "subject_id", "slug"],
  ["site_integrations", "key"], ["landing_pages", "slug"], ["user_roles", "user_id", "role"],
  ["profiles", "user_id"], ["user_favorites", "user_id", "college_slug"],
  ["program_categories", "slug"], ["also_check_modules", "key"], ["authors", "slug"],
  ["hero_categories", "key"], ["jobs", "slug"], ["scholarships", "slug"],
  ["colleges", "slug"], ["courses", "slug"], ["exams", "slug"],
  ["colleges", "short_id"], ["courses", "short_id"], ["exams", "short_id"],
  ["blog_research_sources", "url"], ["cat_universe_settings", "slug"],
  ["cat_universe_sections", "slug"], ["cat_universe_modules", "slug"],
  ["college_universities", "program_slug", "slug"],
  ["college_semesters", "program_slug", "university_slug", "semester_num"],
  ["college_subjects", "program_slug", "university_slug", "semester_num", "branch", "slug"],
  ["career_course_links", "career_slug", "course_slug"], ["intent_lead_scores", "subject_type", "subject_id"],
  ["data_cleaning_items", "job_id", "entity_type", "entity_id"],
  ["data_cleaning_exclusions", "entity_type", "entity_id"],
  ["entity_article_schedules", "entity_type", "entity_slug"],
  ["entity_article_publications", "schedule_id", "article_id"],
  ["legacy_leads_quarantine", "legacy_lead_id"], ["legacy_leads_quarantine", "contact_fingerprint"],
  ["target_roadmaps", "share_token"], ["custom_domains", "domain"],
  ["push_landing_pages", "api_key"], ["multi_push_university_defaults", "university_id"],
];

// Public-schema relationships and delete actions recovered from the August 3
// schema dump plus the later checked-in migrations. Auth-schema relationships
// are enforced by the native Node authorization layer.
const foreignKeys = [
  ["ad_analytics_events", "ad_unit_id", "ad_units", "id", "CASCADE"],
  ["article_links", "article_id", "articles", "id", "CASCADE"],
  ["articles", "author_id", "authors", "id", "SET NULL"],
  ["blog_auto_agent_runs", "entity_schedule_id", "entity_article_schedules", "id", "SET NULL"],
  ["career_profiles", "author_id", "authors", "id", "SET NULL"],
  ["cat_universe_cutoffs", "module_slug", "cat_universe_modules", "slug", "CASCADE"],
  ["cat_universe_modules", "section_slug", "cat_universe_sections", "slug", "CASCADE"],
  ["cat_universe_resources", "module_slug", "cat_universe_modules", "slug", "CASCADE"],
  ["college_facilities", "facility_id", "facilities_library", "id", "CASCADE"],
  ["colleges", "author_id", "authors", "id", "SET NULL"],
  ["courses", "author_id", "authors", "id", "SET NULL"],
  ["data_cleaning_items", "job_id", "data_cleaning_jobs", "id", "CASCADE"],
  ["entity_article_publications", "schedule_id", "entity_article_schedules", "id", "CASCADE"],
  ["entity_article_publications", "article_id", "articles", "id", "CASCADE"],
  ["exams", "author_id", "authors", "id", "SET NULL"],
  ["intent_lead_scores", "lead_id", "leads", "id", "SET NULL"],
  ["job_applications", "job_id", "jobs", "id", "CASCADE"],
  ["lead_notes", "lead_id", "leads", "id", "CASCADE"],
  ["legacy_leads_quarantine", "import_run_id", "legacy_import_runs", "id", "SET NULL"],
  ["placement_records", "company_id", "companies", "id", "SET NULL"],
  ["push_landing_pages", "preset_id", "multi_push_presets", "id", "SET NULL"],
  ["scholarships", "author_id", "authors", "id", "SET NULL"],
  ["study_chapters", "subject_id", "study_subjects", "id", "CASCADE"],
  ["study_resources", "chapter_id", "study_chapters", "id", "CASCADE"],
  ["study_resources", "subject_id", "study_subjects", "id", "CASCADE"],
  ["study_subjects", "author_id", "authors", "id", "SET NULL"],
  ["university_api_keys", "university_id", "universities", "id", "CASCADE"],
  ["url_clicks", "url_id", "url_mappings", "id", "CASCADE"],
  ["wallet_transactions", "referral_id", "referrals", "id", "SET NULL"],
];

function safeIndexName(prefix, table, columns) {
  return `${prefix}_${table}_${columns.join("_")}`.slice(0, 64);
}

async function indexExists(table, name) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1",
    table,
    name,
  );
  return rows.length > 0;
}

async function columnInfo(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT DATA_TYPE AS dataType, IS_NULLABLE AS isNullable, EXTRA AS extra FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    table,
    column,
  );
  return rows[0] || null;
}

async function ensureIntentRuntimeSchema(report) {
  const id = await columnInfo("intent_events", "id");
  if (!String(id?.extra || "").toLowerCase().includes("auto_increment")) {
    await mysqlConnection.query("LOCK TABLES `intent_events` WRITE");
    try {
      const [lockedColumns] = await mysqlConnection.query("SHOW COLUMNS FROM `intent_events` LIKE 'id'");
      if (String(lockedColumns[0]?.Extra || "").toLowerCase().includes("auto_increment")) {
        report.existing.push("intent_events.id:auto_increment");
        return;
      }
      const [statsRows] = await mysqlConnection.query(
        "SELECT CAST(COALESCE(MAX(`id`), 0) AS CHAR) AS maxId, SUM(`id` = 0) AS zeroIds FROM `intent_events`",
      );
      const zeroIds = Number(statsRows[0]?.zeroIds || 0);
      if (!Number.isInteger(zeroIds) || zeroIds < 0 || zeroIds > 1) {
        throw new Error(`intent_events has an unsafe zero-ID count: ${zeroIds}`);
      }
      if (zeroIds === 1) {
        const maximumSignedBigInt = 9_223_372_036_854_775_807n;
        const maxId = BigInt(String(statsRows[0]?.maxId || "0"));
        if (maxId >= maximumSignedBigInt) throw new Error("intent_events has exhausted the signed BIGINT ID range");
        const nextId = (maxId + 1n).toString();
        const [repair] = await mysqlConnection.execute("UPDATE `intent_events` SET `id` = ? WHERE `id` = 0", [nextId]);
        if (Number(repair.affectedRows) !== zeroIds) {
          throw new Error(`intent_events zero-ID repair affected ${repair.affectedRows} row(s); expected ${zeroIds}`);
        }
        const [remainingRows] = await mysqlConnection.query("SELECT COUNT(*) AS zeroIds FROM `intent_events` WHERE `id` = 0");
        if (Number(remainingRows[0]?.zeroIds || 0) !== 0) throw new Error("intent_events zero-ID repair did not complete");
        report.createdRuntimeColumns.push("intent_events.id:zero-resequenced");
      }
      await mysqlConnection.query("ALTER TABLE `intent_events` MODIFY `id` BIGINT NOT NULL AUTO_INCREMENT");
      report.createdRuntimeColumns.push("intent_events.id:auto_increment");
    } finally {
      await mysqlConnection.query("UNLOCK TABLES");
    }
  }
}

async function makeUniqueIndex(table, columns, report) {
  if (!metadata[table] || columns.some((column) => !metadata[table].fields[column])) {
    report.skipped.push({ table, columns, reason: "column is absent from the live schema" });
    return;
  }
  const name = safeIndexName("uq", table, columns);
  if (await indexExists(table, name)) {
    report.existing.push(name);
    return;
  }
  const duplicateSql = `SELECT 1 FROM ${quote(table)} WHERE ${columns.map((column) => `${quote(column)} IS NOT NULL`).join(" AND ")} GROUP BY ${columns.map(quote).join(", ")} HAVING COUNT(*) > 1 LIMIT 1`;
  if ((await prisma.$queryRawUnsafe(duplicateSql)).length) {
    report.skipped.push({ table, columns, reason: "duplicate source values" });
    return;
  }
  for (const column of columns) {
    const info = await columnInfo(table, column);
    if (!["text", "tinytext", "mediumtext", "longtext"].includes(String(info?.dataType || "").toLowerCase())) continue;
    const [{ maxLength }] = await prisma.$queryRawUnsafe(`SELECT COALESCE(MAX(CHAR_LENGTH(${quote(column)})), 0) AS maxLength FROM ${quote(table)}`);
    if (Number(maxLength) > 191) {
      report.skipped.push({ table, columns, reason: `${column} exceeds 191 characters` });
      return;
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE ${quote(table)} MODIFY ${quote(column)} VARCHAR(191) ${info.isNullable === "YES" ? "NULL" : "NOT NULL"}`);
  }
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX ${quote(name)} ON ${quote(table)} (${columns.map(quote).join(", ")})`);
  report.createdUnique.push(name);
}

async function makeForeignKeyIndexes(report) {
  for (const [table, tableMetadata] of Object.entries(metadata)) {
    if (tableMetadata.ignored) continue;
    for (const [column, field] of Object.entries(tableMetadata.fields)) {
      if (!field.foreignKey) continue;
      const name = safeIndexName("ix_fk", table, [column]);
      if (await indexExists(table, name)) {
        report.existing.push(name);
        continue;
      }
      const info = await columnInfo(table, column);
      const expression = ["text", "tinytext", "mediumtext", "longtext"].includes(String(info?.dataType || "").toLowerCase())
        ? `${quote(column)}(191)`
        : quote(column);
      await prisma.$executeRawUnsafe(`CREATE INDEX ${quote(name)} ON ${quote(table)} (${expression})`);
      report.createdForeignKeyIndexes.push(name);
    }
  }
}

async function existingIndexColumns(table) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT INDEX_NAME AS indexName, COLUMN_NAME AS columnName, SEQ_IN_INDEX AS sequence FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX",
    table,
  );
  const indexes = new Map();
  for (const row of rows) indexes.set(row.indexName, [...(indexes.get(row.indexName) || []), row.columnName]);
  return indexes;
}

async function ensureHomepageExploreSchema(report) {
  for (const table of ["colleges", "courses", "exams"]) {
    if (!await columnInfo(table, "show_in_explore_by_category")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE ${quote(table)} ADD COLUMN \`show_in_explore_by_category\` BOOLEAN NOT NULL DEFAULT FALSE`);
      report.createdRuntimeColumns.push(`${table}.show_in_explore_by_category`);
    }
    if (!await columnInfo(table, "explore_by_category_checked_at")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE ${quote(table)} ADD COLUMN \`explore_by_category_checked_at\` DATETIME(3) NULL`);
      report.createdRuntimeColumns.push(`${table}.explore_by_category_checked_at`);
    }
    const name = `ix_${table}_homepage_explore`;
    if (!await indexExists(table, name)) {
      await prisma.$executeRawUnsafe(`CREATE INDEX ${quote(name)} ON ${quote(table)} (\`show_in_explore_by_category\`, \`explore_by_category_checked_at\`)`);
      report.createdReferenceIndexes.push(name);
    }
  }
}

async function ensureCourseFeeGroupingSchema(report) {
  if (!await columnInfo("course_fees", "course_group")) {
    await prisma.$executeRawUnsafe("ALTER TABLE `course_fees` ADD COLUMN `course_group` VARCHAR(191) NULL AFTER `course_name`");
    report.createdRuntimeColumns.push("course_fees.course_group");
  }
  if (!await columnInfo("course_fees", "specialization")) {
    await prisma.$executeRawUnsafe("ALTER TABLE `course_fees` ADD COLUMN `specialization` LONGTEXT NULL AFTER `course_group`");
    report.createdRuntimeColumns.push("course_fees.specialization");
  }
  if (!await columnInfo("course_fees", "academic_level")) {
    await prisma.$executeRawUnsafe("ALTER TABLE `course_fees` ADD COLUMN `academic_level` VARCHAR(32) NULL AFTER `specialization`");
    report.createdRuntimeColumns.push("course_fees.academic_level");
  }
  if (!await columnInfo("course_fees", "duration")) {
    await prisma.$executeRawUnsafe("ALTER TABLE `course_fees` ADD COLUMN `duration` VARCHAR(64) NULL AFTER `academic_level`");
    report.createdRuntimeColumns.push("course_fees.duration");
  }
  const indexName = "ix_course_fees_college_group";
  if (!await indexExists("course_fees", indexName)) {
    await prisma.$executeRawUnsafe(`CREATE INDEX ${quote(indexName)} ON \`course_fees\` (\`college_slug\`(191), \`course_group\`)`);
    report.createdReferenceIndexes.push(indexName);
  }

  // The three sync triggers are created only after the initial aggregate
  // backfill succeeds. Their presence is therefore the durable migration
  // marker for an installation that is already current. Re-running the
  // aggregate UPDATE on every deployment rewrites every college (and fires
  // the updated_at trigger), which can monopolize a small managed MySQL
  // instance for minutes and starve the public API connection pool.
  const requiredTriggers = [
    "trg_sync_course_fees_ins",
    "trg_sync_course_fees_upd",
    "trg_sync_course_fees_del",
  ];
  const triggerRows = await prisma.$queryRawUnsafe(
    "SELECT TRIGGER_NAME AS triggerName FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name IN (?,?,?)",
    ...requiredTriggers,
  );
  const existingTriggers = new Set(triggerRows.map((row) => row.triggerName));
  const courseCountTriggersPresent = requiredTriggers.every((name) => existingTriggers.has(name));
  if (courseCountTriggersPresent) {
    report.existing.push("course_fee_count_backfill");
    return;
  }

  await prisma.$executeRawUnsafe(`
    UPDATE \`colleges\` college
    LEFT JOIN (
      SELECT \`college_slug\`, COUNT(DISTINCT SHA2(CONCAT_WS(CHAR(31),
        COALESCE(NULLIF(TRIM(\`course_slug\`), ''), NULLIF(TRIM(\`course_name\`), ''), 'missing'),
        COALESCE(NULLIF(TRIM(\`specialization\`), ''), 'general')
      ), 256)) AS \`offering_count\`
      FROM \`course_fees\`
      GROUP BY \`college_slug\`
    ) fees ON fees.\`college_slug\` = college.\`slug\`
    SET college.\`courses_count\` = COALESCE(fees.\`offering_count\`, 0)
    WHERE NOT (college.\`courses_count\` <=> COALESCE(fees.\`offering_count\`, 0))
  `);
}

async function ensureLeadAutomationAuditSchema(report) {
  if (!await columnInfo("lp_push_logs", "matched_rule_ids")) {
    await prisma.$executeRawUnsafe("ALTER TABLE `lp_push_logs` ADD COLUMN `matched_rule_ids` JSON NULL AFTER `multi_flow_id`");
    report.createdRuntimeColumns.push("lp_push_logs.matched_rule_ids");
  }
}

async function ensureLeadAutomationPerformanceIndexes(report) {
  const indexes = [
    ["lp_automation_rules", "ix_lp_rules_dispatch", ["is_active", "auto_dispatch", "priority"]],
    ["lp_push_logs", "ix_lp_logs_delivery", ["lead_id", "university_id", "status(32)"]],
    ["lp_push_logs", "ix_lp_logs_rate", ["university_id", "created_at"]],
    ["lp_push_logs", "ix_lp_logs_daily_status", ["status(32)", "created_at"]],
    ["universities", "ix_universities_active", ["is_active"]],
  ];

  for (const [table, name, columns] of indexes) {
    if (await indexExists(table, name)) {
      report.existing.push(name);
      continue;
    }
    await prisma.$executeRawUnsafe(
      `CREATE INDEX ${quote(name)} ON ${quote(table)} (${columns.map((column) => {
        const match = column.match(/^(\w+)\((\d+)\)$/);
        return match ? `${quote(match[1])}(${match[2]})` : quote(column);
      }).join(", ")})`,
    );
    report.createdReferenceIndexes.push(name);
  }
}

async function ensureSiteIsolationSchema(report) {
  const columns = [
    ["articles", "site_scope", "VARCHAR(32) NOT NULL DEFAULT 'dekhocampus'"],
    ["leads", "site_scope", "VARCHAR(32) NOT NULL DEFAULT 'dekhocampus'"],
    ["leads", "consent_terms_accepted", "BOOLEAN NOT NULL DEFAULT FALSE"],
    ["leads", "consent_text", "LONGTEXT NULL"],
    ["leads", "consent_at", "DATETIME(3) NULL"],
  ];
  for (const [table, column, definition] of columns) {
    if (await columnInfo(table, column)) continue;
    await prisma.$executeRawUnsafe(`ALTER TABLE ${quote(table)} ADD COLUMN ${quote(column)} ${definition}`);
    report.createdRuntimeColumns.push(`${table}.${column}`);
  }

  for (const table of ["articles", "leads"]) {
    const constraintName = `chk_${table}_site_scope`;
    const existingConstraint = await prisma.$queryRawUnsafe(
      "SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'CHECK' LIMIT 1",
      table,
      constraintName,
    );
    if (existingConstraint.length) {
      report.existing.push(constraintName);
      continue;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE ${quote(table)} SET \`site_scope\` = 'dekhocampus' WHERE \`site_scope\` IS NULL OR BINARY \`site_scope\` NOT IN ('dekhocampus', 'sarkari')`,
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE ${quote(table)} ADD CONSTRAINT ${quote(constraintName)} CHECK (BINARY \`site_scope\` IN ('dekhocampus', 'sarkari'))`);
    report.createdCheckConstraints.push(constraintName);
  }

  const indexes = [
    ["articles", "ix_articles_site_public", ["site_scope", "is_active", "status(32)", "created_at"]],
    ["articles", "ix_articles_site_category_public", ["site_scope", "is_active", "status(32)", "category(64)", "created_at"]],
    ["articles", "ix_articles_site_featured_public", ["site_scope", "is_active", "status(32)", "featured_rank"]],
    ["leads", "ix_leads_site_created", ["site_scope", "created_at"]],
    ["leads", "ix_leads_site_status_created", ["site_scope", "status(32)", "created_at"]],
  ];
  for (const [table, name, indexColumns] of indexes) {
    if (await indexExists(table, name)) {
      report.existing.push(name);
      continue;
    }
    const expressions = indexColumns.map((column) => {
      const match = column.match(/^(\w+)\((\d+)\)$/);
      return match ? `${quote(match[1])}(${match[2]})` : quote(column);
    });
    await prisma.$executeRawUnsafe(`CREATE INDEX ${quote(name)} ON ${quote(table)} (${expressions.join(", ")})`);
    report.createdReferenceIndexes.push(name);
  }
}

async function ensureArticleWriteLockSchema(report) {
  const existing = await prisma.$queryRawUnsafe(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'article_write_locks' AND table_type = 'BASE TABLE' LIMIT 1",
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`article_write_locks\` (
      \`site_scope\` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      PRIMARY KEY (\`site_scope\`),
      CONSTRAINT \`chk_article_write_locks_site_scope\` CHECK (BINARY \`site_scope\` IN ('dekhocampus', 'sarkari'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (existing.length) report.existing.push("article_write_locks");
  else report.createdRuntimeTables.push("article_write_locks");
  await prisma.$executeRawUnsafe(
    "INSERT IGNORE INTO `article_write_locks` (`site_scope`) VALUES ('dekhocampus'), ('sarkari')",
  );
}

async function retireLegacyArticleSlugIndexes(report) {
  const replacementName = "uq_articles_site_scope_slug";
  const replacementRows = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_NAME AS columnName, SEQ_IN_INDEX AS sequence, NON_UNIQUE AS nonUnique, SUB_PART AS subPart FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'articles' AND index_name = ? ORDER BY seq_in_index",
    replacementName,
  );
  const replacementColumns = replacementRows.map((row) => row.columnName);
  const replacementIsExactUnique = replacementRows.length === 2
    && replacementRows.every((row) => Number(row.nonUnique) === 0 && row.subPart === null)
    && replacementColumns[0] === "site_scope"
    && replacementColumns[1] === "slug";
  if (!replacementIsExactUnique) {
    throw new Error(`Tenant isolation requires ${replacementName} to be an exact UNIQUE index on (site_scope, slug); refusing to retire legacy slug protection`);
  }
  const rows = await prisma.$queryRawUnsafe(
    "SELECT INDEX_NAME AS indexName, COLUMN_NAME AS columnName, SEQ_IN_INDEX AS sequence FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'articles' AND non_unique = 0 AND index_name <> 'PRIMARY' ORDER BY index_name, seq_in_index",
  );
  const indexes = new Map();
  for (const row of rows) indexes.set(row.indexName, [...(indexes.get(row.indexName) || []), row.columnName]);
  for (const [name, columns] of indexes) {
    if (columns.length !== 1 || columns[0] !== "slug") continue;
    await prisma.$executeRawUnsafe(`DROP INDEX ${quote(name)} ON \`articles\``);
    report.droppedLegacyIndexes.push(name);
  }
}

async function makeReferenceIndexes(report) {
  for (const line of postgresSchemaReference.split("\n")) {
    const match = line.match(/^CREATE INDEX (\w+) ON public\.(\w+) USING btree \((.*)\);$/);
    if (!match) continue; // excludes GIN, expressions, and partial indexes
    const [, sourceName, table, rawColumns] = match;
    const columns = rawColumns.split(",").map((column) => column.trim()
      .replace(/\s+(ASC|DESC)(\s+NULLS\s+(FIRST|LAST))?$/i, "")
      .replace(/^"|"$/g, ""));
    if (!metadata[table] || columns.some((column) => !/^\w+$/.test(column) || !metadata[table].fields[column])) {
      report.skipped.push({ table, columns, reason: `reference index ${sourceName} is incompatible with the live schema` });
      continue;
    }
    const indexes = await existingIndexColumns(table);
    if ([...indexes.values()].some((indexed) => columns.every((column, index) => indexed[index] === column))) {
      report.existing.push(sourceName);
      continue;
    }
    const expressions = [];
    for (const column of columns) {
      const info = await columnInfo(table, column);
      expressions.push(["text", "tinytext", "mediumtext", "longtext"].includes(String(info?.dataType || "").toLowerCase())
        ? `${quote(column)}(191)`
        : quote(column));
    }
    const name = sourceName.slice(0, 64);
    try {
      await prisma.$executeRawUnsafe(`CREATE INDEX ${quote(name)} ON ${quote(table)} (${expressions.join(", ")})`);
      report.createdReferenceIndexes.push(name);
    } catch (error) {
      report.skipped.push({ table, columns, reason: `reference index ${sourceName} failed: ${error instanceof Error ? error.message.split("\n").at(-1) : String(error)}` });
    }
  }
}

async function ensureVarchar191(table, column) {
  const info = await columnInfo(table, column);
  if (!["text", "tinytext", "mediumtext", "longtext"].includes(String(info?.dataType || "").toLowerCase())) return true;
  const [{ maxLength }] = await prisma.$queryRawUnsafe(`SELECT COALESCE(MAX(CHAR_LENGTH(${quote(column)})), 0) AS maxLength FROM ${quote(table)}`);
  if (Number(maxLength) > 191) return false;
  await prisma.$executeRawUnsafe(`ALTER TABLE ${quote(table)} MODIFY ${quote(column)} VARCHAR(191) ${info.isNullable === "YES" ? "NULL" : "NOT NULL"}`);
  return true;
}

async function makeForeignKeys(report) {
  for (const [table, column, targetTable, targetColumn, onDelete] of foreignKeys) {
    const name = safeIndexName("fk", table, [column]);
    const existing = await prisma.$queryRawUnsafe(
      "SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY' LIMIT 1",
      table,
      name,
    );
    if (existing.length) {
      report.existing.push(name);
      continue;
    }
    if (!await ensureVarchar191(targetTable, targetColumn) || !await ensureVarchar191(table, column)) {
      report.skipped.push({ table, columns: [column], reason: "foreign-key value exceeds 191 characters" });
      continue;
    }
    const orphans = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM ${quote(table)} source
      LEFT JOIN ${quote(targetTable)} target ON source.${quote(column)} = target.${quote(targetColumn)}
      WHERE source.${quote(column)} IS NOT NULL AND target.${quote(targetColumn)} IS NULL
      LIMIT 1
    `);
    if (orphans.length) {
      report.skipped.push({ table, columns: [column], reason: `orphan value for ${targetTable}.${targetColumn}` });
      continue;
    }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE ${quote(table)} ADD CONSTRAINT ${quote(name)} FOREIGN KEY (${quote(column)}) REFERENCES ${quote(targetTable)} (${quote(targetColumn)}) ON DELETE ${onDelete}`);
      report.createdForeignKeys.push(name);
    } catch (error) {
      report.skipped.push({ table, columns: [column], reason: `foreign key creation failed: ${error instanceof Error ? error.message.split("\n").at(-1) : String(error)}` });
    }
  }
}

async function makeIntegrityTriggers(report) {
  const existingRows = await prisma.$queryRawUnsafe(
    "SELECT TRIGGER_NAME AS triggerName FROM information_schema.triggers WHERE trigger_schema = DATABASE()",
  );
  const existing = new Set(existingRows.map((row) => row.triggerName));
  for (const [table, tableMetadata] of Object.entries(metadata)) {
    if (tableMetadata.ignored || !tableMetadata.fields.updated_at) continue;
    const name = safeIndexName("trg_touch", table, []);
    if (existing.has(name)) {
      report.existing.push(name);
      continue;
    }
    await mysqlConnection.query(`CREATE TRIGGER ${quote(name)} BEFORE UPDATE ON ${quote(table)} FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP(3)`);
    report.createdTriggers.push(name);
  }
  for (const table of ["colleges", "courses", "exams"]) {
    const name = safeIndexName("trg_lock_short_id", table, []);
    if (existing.has(name)) {
      report.existing.push(name);
      continue;
    }
    await mysqlConnection.query(`
      CREATE TRIGGER ${quote(name)} BEFORE UPDATE ON ${quote(table)} FOR EACH ROW
      BEGIN
        IF NOT (NEW.short_id <=> OLD.short_id) THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'short_id is immutable';
        END IF;
      END
    `);
    report.createdTriggers.push(name);
  }
  const countExpression = `(
    SELECT COUNT(DISTINCT SHA2(CONCAT_WS(CHAR(31),
      COALESCE(NULLIF(TRIM(fee.course_slug), ''), NULLIF(TRIM(fee.course_name), ''), 'missing'),
      COALESCE(NULLIF(TRIM(fee.specialization), ''), 'general')
    ), 256))
    FROM course_fees fee
    WHERE fee.college_slug = %SLUG%
  )`;
  const courseCountTriggers = [
    ["trg_sync_course_fees_ins", `AFTER INSERT ON \`course_fees\` FOR EACH ROW UPDATE \`colleges\` SET \`courses_count\` = ${countExpression.replace("%SLUG%", "NEW.college_slug")} WHERE \`slug\` = NEW.college_slug`],
    ["trg_sync_course_fees_del", `AFTER DELETE ON \`course_fees\` FOR EACH ROW UPDATE \`colleges\` SET \`courses_count\` = ${countExpression.replace("%SLUG%", "OLD.college_slug")} WHERE \`slug\` = OLD.college_slug`],
    ["trg_sync_course_fees_upd", `AFTER UPDATE ON \`course_fees\` FOR EACH ROW BEGIN
      UPDATE \`colleges\` SET \`courses_count\` = ${countExpression.replace("%SLUG%", "OLD.college_slug")} WHERE \`slug\` = OLD.college_slug;
      UPDATE \`colleges\` SET \`courses_count\` = ${countExpression.replace("%SLUG%", "NEW.college_slug")} WHERE \`slug\` = NEW.college_slug;
    END`],
  ];
  for (const obsoleteName of ["trg_derive_college_courses_ins", "trg_derive_college_courses_upd"]) {
    if (!existing.has(obsoleteName)) continue;
    await mysqlConnection.query(`DROP TRIGGER ${quote(obsoleteName)}`);
    existing.delete(obsoleteName);
  }
  for (const [name, definition] of courseCountTriggers) {
    if (existing.has(name)) {
      report.existing.push(name);
      continue;
    }
    await mysqlConnection.query(`CREATE TRIGGER ${quote(name)} ${definition}`);
    report.createdTriggers.push(name);
  }
}

async function createViews() {
  async function prepareView(name) {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT TABLE_TYPE AS tableType FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      name,
    );
    if (rows[0]?.tableType === "VIEW") {
      await prisma.$executeRawUnsafe(`DROP VIEW ${quote(name)}`);
    } else if (rows[0]?.tableType === "BASE TABLE") {
      const [{ rowCount }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS rowCount FROM ${quote(name)}`);
      if (Number(rowCount) !== 0) throw new Error(`Refusing to replace non-empty placeholder table ${name}`);
      await prisma.$executeRawUnsafe(`DROP TABLE ${quote(name)}`);
    }
  }

  await prepareView("leads_daily_business_rollup");
  await prisma.$executeRawUnsafe(`
    CREATE VIEW \`leads_daily_business_rollup\` AS
    SELECT
      MIN(id) AS representative_id,
      site_scope,
      DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) AS lead_day,
      COALESCE(
        NULLIF(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', ''), ''),
        LOWER(NULLIF(email, '')),
        id
      ) AS identity_key,
      MAX(
        LOWER(COALESCE(source, '')) LIKE '%silent%'
        OR LOWER(COALESCE(source_category, '')) IN ('silent', 'behavioral', 'intent', 'engagement')
      ) AS is_silent,
      COUNT(*) AS event_count,
      MIN(created_at) AS first_seen_at,
      MAX(created_at) AS last_seen_at
    FROM \`leads\`
    GROUP BY site_scope, lead_day, identity_key
  `);

  await prepareView("college_editorial_completion_progress");
  await prisma.$executeRawUnsafe(`
    CREATE VIEW \`college_editorial_completion_progress\` AS
    SELECT
      CAST(COUNT(*) AS SIGNED) AS total_colleges,
      CAST(SUM(status = 'complete') AS SIGNED) AS complete_colleges,
      CAST(SUM(status = 'pending') AS SIGNED) AS pending_colleges,
      CAST(SUM(source_status = 'official_source_linked') AS SIGNED) AS official_source_linked,
      CAST(SUM(source_status = 'official_source_pending') AS SIGNED) AS official_source_pending,
      CAST(SUM(course_status = 'official_courses_verified') AS SIGNED) AS official_courses_verified,
      CAST(SUM(fee_status = 'official_fees_verified') AS SIGNED) AS official_fees_verified,
      CAST(SUM(JSON_CONTAINS(COALESCE(missing_requirements, JSON_ARRAY()), JSON_QUOTE('human_editor_review_pending'))) AS SIGNED) AS human_review_pending,
      MAX(updated_at) AS last_updated_at
    FROM \`college_editorial_completion_queue\`
  `);
}

const report = { createdRuntimeColumns: [], createdRuntimeTables: [], createdUnique: [], createdReferenceIndexes: [], createdForeignKeyIndexes: [], createdForeignKeys: [], createdTriggers: [], createdCheckConstraints: [], droppedLegacyIndexes: [], existing: [], skipped: [], views: [] };
try {
  await ensureSiteIsolationSchema(report);
  await ensureArticleWriteLockSchema(report);
  await ensureIntentRuntimeSchema(report);
  await ensureHomepageExploreSchema(report);
  await ensureCourseFeeGroupingSchema(report);
  await ensureLeadAutomationAuditSchema(report);
  await ensureLeadAutomationPerformanceIndexes(report);
  for (const [table, ...columns] of uniqueIndexes) await makeUniqueIndex(table, columns, report);
  await retireLegacyArticleSlugIndexes(report);
  await makeReferenceIndexes(report);
  await makeForeignKeyIndexes(report);
  await makeForeignKeys(report);
  await makeIntegrityTriggers(report);
  await createViews();
  report.views = ["leads_daily_business_rollup", "college_editorial_completion_progress"];
  if (process.argv.includes("--quiet")) {
    console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([key, value]) => [key, value.length]))));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  await mysqlConnection.end();
  await prisma.$disconnect();
}
