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

The latest request supersedes the earlier ring design. Cards show the short name followed by the expanded exam name. The logo component uses the reviewed exam/institution/authority mark with no added decorative ring, image cropping, or background-photo fallback. Long status labels occupy a separate row so they cannot squeeze the name out of view. Refresh-report SEO titles do not overwrite the expanded name.

`shared/exam-identities.json` records all 485 identities, source URLs, source pages and unresolved-review notes. There are 424 records with visually reviewed official-source marks, 51 retained existing catalog marks, and 10 explicitly unresolved sources. The retained catalog marks have not been newly certified as official. Do not invent seals or assume one campus's logo represents a joint examination.

Official marks are stored in `public/exam-logos/official-v1` as content-hashed WebP files, quality 95 and a maximum 600-pixel dimension, without synthetic enlargement. White official wordmarks use a dark background for contrast. The frontend serves these first-party assets immediately for missing or obsolete generated ring logos. Existing valid custom logos remain unchanged. The obsolete ring generator has been removed.

Run `node scripts/audit-exam-identities.mjs` to validate catalog coverage, source fields, file hashes and dimensions. Use `--write` to rebuild the CSV/Markdown audit reports or `--require-complete` to fail on any unresolved source. Source discovery/contact-sheet scripts prepare candidates only; they never approve or publish a logo automatically. Every replacement must be visually checked against the official page before its inventory entry is changed.

## Safe production execution

The sync is intentionally opt-in. **Do not enable `sync_exam_catalog` while the 10 source gaps remain.** The full sync (`--apply --logos --assert-complete`) fails before any database write if a reviewed logo is missing. The frontend can be deployed independently: names and reviewed marks are resolved in all public/admin exam components without rewriting production content.

Once source coverage is complete, run the AWS production workflow with `sync_exam_catalog=true`. Before changing rows, it uploads a complete row backup to `system-backups/exam-catalog/<run>/exams-before.json`. It restores missing canonical rows, writes names/filters, deactivates only approved legacy rows, copies the reviewed WebP assets to `admin-uploads/exam-logos-official-v1`, and uploads a final report. No AI-generated or monogram replacements are made.

The job fails if a canonical exam is absent, any filter group is empty, any logo remains incomplete, or an upload/validation fails. Reports distinguish updated and retained logos. No logo object is deleted by this migration; the before-image supports rollback.
