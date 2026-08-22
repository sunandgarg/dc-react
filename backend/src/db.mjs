import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export const schemaMetadata = JSON.parse(
  await readFile(new URL("../prisma/schema-metadata.json", import.meta.url), "utf8"),
);

export const tableNames = new Set(Object.keys(schemaMetadata));

export function assertIdentifier(value, allowed = null) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value))) throw new Error(`Invalid identifier: ${value}`);
  if (allowed && !allowed.has(value)) throw new Error(`Unknown identifier: ${value}`);
  return value;
}

export const quote = (identifier) => `\`${assertIdentifier(identifier).replaceAll("`", "``")}\``;

export function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return item.toString();
    if (item && typeof item === "object" && typeof item.toJSON === "function") return item.toJSON();
    return item;
  }));
}

