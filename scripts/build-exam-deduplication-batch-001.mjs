import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "reports/pre-rollback-2026-07-29/exams-current.json"), "utf8"));
const checkedAt = "2026-09-21T00:00:00+05:30";

// Canonical rows keep the most stable URL (or the highest-quality record). Duplicate
// rows are soft-deleted after references/content are merged into the canonical row.
const groups = [
  ["JEE Main", "22e4c25a-09e3-435e-a512-bc3d46b5cc54", "jee-mains", [["7feca44a-63b4-4a3b-a874-7f9ce88c217f", "jee-main-2026", "year-suffixed duplicate"], ["ee645bd6-dfa2-42f2-a125-b2fc175c5c05", "dekho-sample-jee-main", "demo duplicate; remove from production catalogue"]]],
  ["JEE Advanced", "5966ee69-0c74-4a16-83c9-1a20e46463c4", "jee-advanced", [["4ea0689e-a807-4ad6-b90e-a21ec74d6c1f", "jee-advanced-2026", "year-suffixed duplicate"]]],
  ["NEET UG", "8720f71d-a911-4735-bb5f-ce1181a6fc91", "national-eligibility-cum-entrance-test-neet", [["7a986b2e-1b62-4a83-b076-6959b480eb4b", "neet", "lower-quality duplicate"], ["243b6c91-3520-4b1e-9fc1-2288c1c7e456", "neet-ug-2026", "year-suffixed duplicate"]]],
  ["CAT", "2307c7a9-a10d-4ed2-aec7-334c0960e4e6", "common-admission-test", [["874416d9-1219-4247-8572-2eb08cd82d75", "cat", "lower-quality duplicate; merge any batch-001 CAT content into canonical row"]]],
  ["CLAT", "b7998bdf-a4a9-400a-9446-f4a0bd1ed85b", "clat", [["484a7717-df09-4f59-a2db-34dec8f9edd7", "clat-2026", "year-suffixed duplicate"]]],
  ["GATE", "f24379ee-aad3-4b6d-99dc-e449dfc17045", "gate", [["1bf4b6a1-5575-40f8-85d8-3701d46b3aba", "gate-2026", "year-suffixed duplicate"]]],
  ["UCEED", "ac281e4e-e526-43bd-9c25-47b408ec2dcf", "uceed", [["6a368f50-77ff-4b39-b6fa-98f23fe7ccc9", "uceed-2026", "year-suffixed duplicate; UCEED remains distinct from CEED"]]],
  ["XAT", "3b6b2846-b3ad-48f2-81c5-cccea74bef96", "xat", [["6ef5c13b-4606-47a8-aab2-3d6cf0793b12", "xat-2026", "year-suffixed duplicate"]]],
  ["BITSAT", "e79ff5cb-aa94-4c8e-b271-1c5be04f4493", "bitsat", [["005b84df-f49d-418c-a207-e0aa1d167f40", "bitsat-2026", "year-suffixed duplicate"]]],
  ["COMEDK UGET", "54233372-6e90-47a5-a61e-49031ca723eb", "comedk", [["708b3668-c17d-4ba4-90cf-8f66918c760e", "comedk-uget", "slug duplicate"]]],
  ["WBJEE", "6aee3463-2af7-442d-a3f5-9d2a79e2c560", "wbjee", [["7da7272a-3b27-4caf-87f1-0ee550c01e9b", "west-bengal-joint-entrance-examinations-board", "long-slug duplicate"]]],
  ["AP EAPCET", "6e861fe9-beff-4560-b145-df130ae8d77b", "ap-eamcet", [["5e8b29e1-d73b-4550-8981-d9ac7b924806", "ap-eapcet", "alternate-name duplicate"]]],
  ["CEED", "68c8cf19-b7c5-4624-a2c7-21a1df96dd90", "CEED", [["5c6ea222-e568-42bd-b6a2-4cd84e1c4da7", "ceed", "case-only slug duplicate; CEED is distinct from UCEED"]]],
  ["BHU PET", "0375f25c-63d1-48f7-8515-09344f131150", "bhu-pet", [["957a6d86-8938-4af2-8b5d-306d63587965", "banaras-hindu-university-postgraduate-entrance-test", "long-slug duplicate"]]],
  ["CUET UG", "f31d18ac-0e9c-4648-b979-856b3f24fbfa", "cuet-2026", [["914acdc7-befc-42c0-863e-c04cf9bde4db", "cuet-ug", "same NTA CUET UG route; lower-quality duplicate approved for removal"]]],
];

const byId = new Map(snapshot.map((row) => [row.id, row]));
const deletions = [];
const keeps = [];
for (const [name, keepId, keepSlug, duplicates] of groups) {
  const keep = byId.get(keepId);
  if (!keep) throw new Error(`Canonical row missing: ${name} ${keepId}`);
  keeps.push({ id: keepId, name, slug: keepSlug });
  for (const [deleteId, deleteSlug, reason] of duplicates) {
    const row = byId.get(deleteId);
    if (!row) throw new Error(`Duplicate row missing: ${name} ${deleteId}`);
    if (row.is_active === false) throw new Error(`Duplicate already inactive: ${deleteId}`);
    deletions.push({ id: deleteId, name: row.name, old_slug: deleteSlug, merge_to_id: keepId, merge_to_slug: keepSlug, reason, operation: "soft_delete" });
  }
}

const payload = {
  batch: "exam-deduplication-001",
  checked_at: checkedAt,
  source_snapshot: "reports/pre-rollback-2026-07-29/exams-current.json",
  operation: "soft_delete_after_merge",
  rationale: "Remove confirmed duplicate exam rows without breaking indexed URLs or foreign-key references. Canonical rows remain active; duplicate rows should be set is_active=false after any content/reference merge.",
  important_distinction: "CEED and UCEED are different design exams. Their duplicate rows are removed, but one canonical CEED row and one canonical UCEED row remain.",
  canonical_rows: keeps,
  deletions,
  safety_checks: [
    "Resolve each id before mutation and abort if a row is missing or already inactive.",
    "Merge content, internal references and any batch-001/002 updates into merge_to_id before deactivation.",
    "Do not hard-delete rows until foreign-key/reference counts are zero and a backup exists.",
    "Preserve existing canonical slugs; redirect duplicate slugs to the canonical slug if the router supports redirects.",
  ],
};
fs.writeFileSync(path.join(root, "reports/exam-deduplication-batch-001-2026-09-21.json"), JSON.stringify(payload, null, 2) + "\n");

const lines = ["# Exam deduplication batch 001", "", `Checked: ${checkedAt} (Asia/Kolkata)`, "", `This manifest contains ${deletions.length} confirmed duplicate rows across ${keeps.length} canonical exam records. It is intentionally a soft-delete plan: merge references first, then set is_active=false. No production mutation was run because this workspace has no production database credentials.`, "", "## What stays", "", ...keeps.map((r) => `- **${r.name}** - keep **${r.slug}** (${r.id})`), "", "## What is approved for removal", "", ...deletions.map((r) => `- **${r.name}** - deactivate **${r.old_slug}** (${r.id}); merge into **${r.merge_to_slug}** (${r.merge_to_id}). Reason: ${r.reason}.`), "", "## Important naming note", "", "- UCEED and CEED are not duplicates of each other. They are separate design entrance exams; only their extra rows are removed.", "- CUET UG duplicate approval from the earlier review is included.", "- The JEE Main demo row is included because it is not a real production exam listing.", "", "## Apply safely", "", "1. Back up the live exams table.", "2. Merge content and references using merge_to_id.", "3. Confirm duplicate slugs are not needed by active routes.", "4. Set is_active=false for every deletion id in the JSON manifest.", "5. Verify /exams, sitemap output and redirects before any hard delete.", ""];
fs.writeFileSync(path.join(root, "reports/exam-deduplication-batch-001-2026-09-21.md"), lines.join("\n"));
console.log(`Wrote ${deletions.length} duplicate removals and ${keeps.length} canonical rows.`);
