# Exam catalog, filter and logo migration

## Verified scope

- Canonical active catalog after the approved duplicate removals: 485 exams.
- Production snapshot before this migration: 236 active exams.
- Canonical exams absent from that production snapshot: 266.
- Production-only legacy rows: 17. The migration deactivates these only after the canonical rows are present.
- Refresh artifacts applied while rebuilding missing rows: 41 reviewed batches.

The per-exam classification and logo decision is recorded in `reports/exam-catalog-filter-logo-manifest-2026-09-23.csv` and its JSON companion. These files contain one row for every canonical exam, so omissions cannot be hidden inside a summary count.

## Public filters

The legacy `category`, `level`, and `exam_type` columns keep their editorial meanings. The public listing uses separate fields:

- `listing_category`: Entrance, Board, Sarkari or Study Abroad.
- `exam_streams`: one or more supported study or recruitment streams.
- `course_groups`: one or more degree or outcome groups.
- `education_levels`: UG, PG, 12th or 10th.
- `exam_filter_version`: the version of the deterministic mapping policy.

The public Exams page sends scalar equality for category and JSON overlap filters for the other three groups. It also requests an exact server count, so the heading reports all matching exams instead of only the currently loaded cards.

## Logo policy

The five supplied AWS logo references are assigned to their exact exams. Any other approved theme logo under `sanitized/bottom-12-v1` is retained. Every remaining exam receives a 1080 by 950 WebP at quality 95 under `admin-uploads/exam-logos-v2`.

When an existing official exam mark is available, it is placed inside the established two-colour circle treatment. When it is unavailable or unreadable, the renderer creates a clean exam-name monogram rather than inventing an official seal. Every generated object is read back through Sharp and must report WebP, 1080 pixels wide and 950 pixels high before its database URL is saved.

## Safe production execution

The sync is intentionally opt-in. Run the AWS production workflow with `sync_exam_catalog=true`. Before changing rows, the job uploads a complete database-row backup to `system-backups/exam-catalog/<run>/exams-before.json`. It then restores missing canonical rows, writes all filters, deactivates only the approved legacy rows, creates themed logos, and uploads a final machine-readable report.

The job fails if the final active catalog is below 400, if any of the 485 canonical exams is absent, if any filter group is empty, if a logo is outside the approved theme, or if any generation or upload fails.
