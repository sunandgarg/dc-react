import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeDirectoryText, rankDirectoryRow } from "../src/directory-search.mjs";

test("directory search normalizes degree punctuation", () => {
  assert.equal(normalizeDirectoryText("B.Tech / CSE"), "b tech cse");
});

test("directory search strongly ranks acronyms and exact aliases", () => {
  const lpu = { name: "Lovely Professional University", search_alias: "LPU", slug: "lovely-professional-university", subtitle: "Jalandhar" };
  const other = { name: "Punjab Technical University", search_alias: "PTU", slug: "punjab-technical-university", subtitle: "Punjab" };
  assert.ok(rankDirectoryRow("lpu", lpu) > rankDirectoryRow("lpu", other));
  assert.ok(rankDirectoryRow("lpu", lpu) > 1_000);
});

test("directory search matches compact degree queries", () => {
  const course = { name: "B.Tech Computer Science", search_alias: "Bachelor of Technology", slug: "btech-computer-science", subtitle: "UG" };
  assert.ok(rankDirectoryRow("btech", course) >= 0);
});

test("directory cache loads names without large image columns", () => {
  const source = readFileSync(new URL("../src/directory-search.mjs", import.meta.url), "utf8");
  const query = source.match(/async function loadDirectoryRows\(\) \{[\s\S]*?\$queryRawUnsafe\(`([\s\S]*?)`\)/)?.[1];
  assert.ok(query);
  for (const table of ["colleges", "courses", "exams", "career_profiles"]) {
    assert.match(query, new RegExp(`FROM ${table} WHERE is_active = 1`));
  }
  assert.doesNotMatch(query, /\b(?:image|logo|description)\b(?!_url)/);
});
