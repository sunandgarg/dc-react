# Exam refresh repository audit

Audit date: 2026-09-23

Status: **NOT PRODUCTION READY**

## What is safely in Git

- 41 contiguous batch builders and 41 JSON plus 41 Markdown report slots were found.
- The reports contain 410 update versions for 390 unique slugs.
- Two human editorial rechecks add 11 more versions, for 421 total artifact versions.
- 20 slugs repeat across numbered batches; 30 have competing batch or recheck versions.
- The deduplication plan proposes 17 soft deletes across 15 canonical groups, but it was not applied.
- The report files are review artifacts. No deployment step imports them into MySQL.

## Coverage gap

- Old snapshot rows: 506; active in that snapshot: 502.
- Unique refreshed slugs: 390.
- Active snapshot slugs not covered: 112.
- The live production count differs from this snapshot, so IDs and slugs must be resolved again before a write.

## Final-policy gap

- Rows with final content-variation metadata: 10.
- Rows containing a forbidden repeated phrase: 370.
- Rows that repeat FAQ questions inside body HTML: 370.
- Application copy in duplicate groups: 354; largest exact group: 150.
- Preparation copy in duplicate groups: 202; largest exact group: 90.
- Distinct FAQ questions: 396 of 760.

## Required cutover order

1. Regenerate or individually review the active canonical production exams under the current strategy.
2. Resolve every duplicate and competing artifact version.
3. Preflight the approved manifest against current live slugs and status.
4. Back up exam and FAQ rows, apply in a transaction, and keep a rollback manifest.
5. Verify public pages, FAQs, API and sitemap after the database write.

Canonical policy: `docs/exam-content-strategy-2026.md`.
