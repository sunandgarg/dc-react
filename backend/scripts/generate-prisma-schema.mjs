#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const input = process.argv[2] || "work/supabase-openapi.json";
const output = process.argv[3] || "backend/prisma/schema.prisma";
const spec = JSON.parse(await readFile(input, "utf8"));

const tableNames = Object.keys(spec.paths || {})
  .filter((name) => name.startsWith("/") && !name.startsWith("/rpc/"))
  .map((name) => name.slice(1))
  .filter((name) => spec.definitions?.[name])
  .sort();

function prismaType(property) {
  const format = String(property.format || "").toLowerCase();
  if (property.type === "array" || format.endsWith("[]") || format === "json" || format === "jsonb" || !property.type) return "Json";
  if (property.type === "boolean") return "Boolean";
  if (property.type === "number") return format === "real" || format.includes("double") ? "Float" : "Decimal";
  if (property.type === "integer") return format === "bigint" ? "BigInt" : "Int";
  if (format.includes("timestamp")) return "DateTime";
  if (format === "date") return "DateTime";
  if (format.startsWith("time")) return "DateTime";
  if (format === "bytea") return "Bytes";
  return "String";
}

function nativeType(property, type, indexed = false) {
  const format = String(property.format || "").toLowerCase();
  if (type === "String" && format === "uuid") return " @db.Char(36)";
  if (type === "String" && indexed) return " @db.VarChar(191)";
  if (type === "String") return " @db.LongText";
  if (type === "Decimal") return " @db.Decimal(65, 20)";
  if (type === "DateTime" && format === "date") return " @db.Date";
  if (type === "DateTime" && format.includes("timestamp")) return " @db.DateTime(3)";
  if (type === "DateTime" && format.startsWith("time")) return " @db.Time(3)";
  if (type === "DateTime") return " @db.DateTime(3)";
  if (type === "Bytes") return " @db.LongBlob";
  return "";
}

function simpleDefault(property, type) {
  const value = property.default;
  if (value === undefined || value === null || type === "Json" || type === "Bytes") return "";
  if (String(value).includes("gen_random_uuid")) return " @default(uuid())";
  if (String(value).toLowerCase() === "now()" && type === "DateTime") return " @default(now())";
  if (type === "Boolean" && typeof value === "boolean") return ` @default(${value})`;
  if (["Int", "BigInt", "Float", "Decimal"].includes(type) && typeof value === "number") return ` @default(${value})`;
  // MySQL does not permit defaults on TEXT/LONGTEXT columns. Runtime inserts
  // apply the OpenAPI defaults recorded in schema-metadata.json instead.
  return "";
}

function isPrimaryKey(property) {
  return String(property.description || "").includes("<pk/>");
}

const models = [];
const metadata = {};

for (const tableName of tableNames) {
  const definition = spec.definitions[tableName];
  const required = new Set(definition.required || []);
  const properties = definition.properties || {};
  const primaryKeys = Object.entries(properties).filter(([, property]) => isPrimaryKey(property)).map(([name]) => name);
  const lines = [`model ${tableName} {`];
  const fields = {};

  for (const [fieldName, property] of Object.entries(properties)) {
    const type = prismaType(property);
    const optional = required.has(fieldName) ? "" : "?";
    const id = primaryKeys.length === 1 && primaryKeys[0] === fieldName ? " @id" : "";
    lines.push(`  ${fieldName} ${type}${optional}${id}${simpleDefault(property, type)}${nativeType(property, type, primaryKeys.includes(fieldName))}`);
    fields[fieldName] = {
      type,
      nullable: !required.has(fieldName),
      primaryKey: primaryKeys.includes(fieldName),
      format: property.format || null,
      default: property.default ?? null,
      foreignKey: String(property.description || "").match(/<fk table='([^']+)' column='([^']+)'\/>/)?.slice(1) || null,
    };
  }

  if (primaryKeys.length > 1) lines.push(`  @@id([${primaryKeys.join(", ")}])`);
  lines.push(`  @@map(${JSON.stringify(tableName)})`);
  if (primaryKeys.length === 0) lines.push("  @@ignore");
  lines.push("}");
  models.push(lines.join("\n"));
  metadata[tableName] = { primaryKeys, fields, ignored: primaryKeys.length === 0 };
}

const schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

${models.join("\n\n")}
`;

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, schema);
await writeFile(path.join(path.dirname(output), "schema-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Generated ${tableNames.length} Prisma models at ${output}`);
