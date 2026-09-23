#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { prisma } from "../src/db.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const option = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) || "";
const expected = Number.parseInt(option("--expected"), 10);
const backupPath = option("--backup");

try {
  const editor = await prisma.authors.findFirst({
    where: { name: "Geethika Reddy", is_active: true },
    select: { id: true, name: true, slug: true },
  });
  if (!editor) throw new Error("Geethika Reddy's active author profile was not found");

  const candidates = [];
  let cursor;
  for (;;) {
    const rows = await prisma.articles.findMany({
      where: { site_scope: "dekhocampus" },
      select: { id: true, slug: true, title: true, author: true, author_id: true, tags: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    candidates.push(...rows.filter((row) => Array.isArray(row.tags) && row.tags.includes("auto-blog-agent") && row.author_id !== editor.id));
    cursor = rows.at(-1).id;
  }

  const backup = {
    generated_at: new Date().toISOString(),
    scope: "dekhocampus auto-blog-agent tagged articles only",
    editor,
    candidates: candidates.map(({ id, slug, title, author, author_id }) => ({ id, slug, title, author, author_id })),
  };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", editor: editor.name, count: candidates.length, sample: backup.candidates.slice(0, 20) }, null, 2));

  if (apply) {
    if (!Number.isInteger(expected) || expected !== candidates.length) throw new Error(`Expected count must match ${candidates.length}; pass --expected=${candidates.length}`);
    if (!isAbsolute(backupPath)) throw new Error("Pass an absolute --backup=/path/file.json before applying");
    await writeFile(resolve(backupPath), `${JSON.stringify(backup, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    let updated = 0;
    for (const row of candidates) {
      const result = await prisma.articles.updateMany({
        where: { id: row.id, site_scope: "dekhocampus", author: row.author, author_id: row.author_id },
        data: { author: editor.name, author_id: editor.id, updated_at: new Date() },
      });
      updated += result.count;
    }
    console.log(JSON.stringify({ mode: "apply", updated, skipped_after_race: candidates.length - updated, backup: resolve(backupPath) }));
  }
} finally {
  await prisma.$disconnect();
}
