import test from "node:test";
import assert from "node:assert/strict";
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
