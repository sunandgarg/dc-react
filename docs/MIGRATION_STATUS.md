# MySQL migration status

Last verified: 2026-08-22

## Current outcome

The existing React interface now has a selectable Node.js, Prisma, and MySQL data path. A point-in-time export of all 149 readable Supabase REST resources was loaded into an isolated local MySQL 9.6 database. Public pages run against the local Node API. Supabase remains a documented compatibility dependency for Auth, Storage, Realtime, and Edge Functions.

This state is safe for local development and public-page verification. It is **not approved for a production cutover away from Supabase** until every blocked item below is completed.

## Completed and verified

- [x] Preserved the React component tree, routes, styling, and responsive user interface.
- [x] Added `VITE_USE_MYSQL`, `VITE_USE_SUPABASE`, and `VITE_API_URL` switches.
- [x] Routed existing `supabase.from(...)` calls through the Node compatibility API without rewriting individual pages.
- [x] Generated 149 Prisma model definitions from the live Supabase REST schema.
- [x] Imported 58,669 physical-table rows into local MySQL with zero importer errors.
- [x] Implemented compatible GET, HEAD, POST, PATCH, DELETE, filtering, ordering, ranges, counts, one-level relationships, JSON decoding, defaults, and object responses.
- [x] Implemented MySQL RPC handlers for `has_role`, `clear_featured_rank`, `set_featured_rank`, `set_ai_emergency_stop`, `intent_merge_visitor`, `increment_url_clicks`, `is_user_approved`, `search_directory_fast`, and `get_data_cleaning_coverage`.
- [x] Added anonymous public-table allowlists, authenticated ownership checks for user tables, and admin checks for private tables and RPCs. Corrected `profiles` ownership to use `user_id`.
- [x] Recovered 48 safe unique indexes, 95 additional simple B-tree performance indexes, 29 foreign-key lookup indexes, and all 29 discoverable public-schema foreign-key constraints with their original delete actions. Another 21 source indexes were already covered by an equal or stronger target index.
- [x] Added 97 automatic `updated_at` triggers plus immutable `short_id` triggers for colleges, courses, and exams.
- [x] Translated `college_editorial_completion_progress` and `leads_daily_business_rollup` to read-only MySQL views and exposed them through the Node API.
- [x] Compared both MySQL view result sets with the Supabase export. Every value matched: one daily lead rollup and one editorial progress row covering 935 colleges.
- [x] Added an idempotent `db:parity` step to database setup.
- [x] Added Docker, a local Node server, Prisma generation/import/parity scripts, and AWS SAM configuration.
- [x] Verified health, public reads, denied private reads, search RPC, insert/object response, cleanup, nested relationship hydration, and both read-only views against local MySQL.
- [x] Verified the homepage, college directory, course directory, and exam directory against Node/MySQL. The college directory rendered imported records including ICFAI Business School Gurgaon, JECRC University, and Masters' Union.
- [x] Passed 114 frontend tests across 26 test files.
- [x] Passed TypeScript validation with `tsc --noEmit`.
- [x] Passed the full ESLint command with zero errors. There are 101 non-blocking legacy Hook-dependency/Fast Refresh warnings still listed below.
- [x] Completed the Vite 8 production build and generated 237,993 sitemap URLs across six files.
- [x] Upgraded Vite, React Router, Sharp, the React SWC plugin, and Lovable Tagger; both frontend and backend production audits report zero vulnerabilities.
- [x] Confirmed the supplied Supabase secret is absent from tracked source files.

## Completed but requiring production verification

- [~] The database import is point-in-time. A final delta export and write freeze are required at cutover.
- [~] Prisma/MySQL types, primary keys, JSON values, timestamps, 48 unique indexes, 124 additional indexes, 29 relationship constraints, 100 integrity triggers, and both views are implemented. PostgreSQL check constraints, 12 partial/functional indexes, complex workflow triggers/functions, and final migration ordering still require a current catalog-level parity review.
- [~] PostgreSQL declared `exams.slug` unique, but the live exported data contains two rows with slug `ceed`. The parity script safely skips that unique index instead of deleting or changing source data.
- [~] The Node API validates Supabase JWTs during the compatibility phase. Production latency, token refresh, admin access, and user-owned dashboard flows need staging tests with real accounts.
- [~] Docker and AWS deployment configuration are prepared but not deployed because production infrastructure credentials were not provided.

## Remaining work and blockers

### 1. Production MySQL database and deployment

- **What is left:** provision production MySQL, apply schema/import/parity, run a final delta import, deploy the Node API, and configure the production frontend API URL.
- **Why blocked:** no production `DATABASE_URL`, MySQL host/user/password/TLS settings, deployment account, API hostname, DNS permission, or cutover window was supplied.
- **Required:** production MySQL credentials, chosen hosting target, API hostname, TLS policy, DNS access, and deployment permission.
- **Affected:** all `/v1/rest/*` and `/v1/rest/rpc/*` routes and the production frontend environment.
- **Can the app safely run without it:** yes locally or on the existing Supabase production path; no for production MySQL cutover.
- **Recommended action:** provision staging MySQL first, deploy the API, and run the acceptance matrix before production.

### 2. Final database parity and one source-data conflict

- **What is left:** compare the current live PostgreSQL catalog with MySQL; translate remaining check constraints, safe partial-index equivalents, and complex workflow triggers/functions. Resolve the duplicated `ceed` exam slug before enabling its unique index.
- **Why blocked:** the tracked `db-export/full_schema.sql` is useful but dates from August 3 and contains 117 tables, while the August 22 live REST schema contains 149 resources. Later checked-in migrations were applied to parity where determinable, but only a fresh catalog export can prove the final live order/state. Automatically choosing which duplicate exam row to change or delete would corrupt source intent.
- **Required:** a fresh `pg_dump --schema-only` or live catalog-read access, plus an owner decision for the two `ceed` exam records.
- **Affected:** production write integrity, cascade behavior, background workflows, query performance, and exam slug routing.
- **Can the app safely run without it:** local read verification is safe; unrestricted production writes are not approved.
- **Recommended action:** export the live schema, diff it against `backend/scripts/apply-mysql-parity.mjs`, resolve the duplicate in the source system, then rerun parity and write tests.

### 3. Supabase Auth replacement

- **What is left:** replace Supabase Auth, migrate identities, configure Google OAuth, recreate password/OTP flows, and remove Supabase JWT validation.
- **Why blocked:** passwords are not exportable and OAuth/email/SMS credentials plus an identity-provider decision were not supplied.
- **Required:** replacement identity provider, OAuth client credentials, email/SMS credentials, redirect URLs, and a user reset/link plan.
- **Affected:** sign-in, onboarding, dashboards, admin access, invitations, phone OTP, and protected Node routes.
- **Can the app safely run without it:** yes while Supabase Auth remains enabled; no after Supabase is removed.
- **Recommended action:** retain Supabase Auth in staging, migrate accounts through a controlled link/reset flow, then switch Node JWT validation.

### 4. Supabase Storage migration

- **What is left:** copy and verify `ad-images`, `user-documents`, `admin-uploads`, `study-material`, and `legacy-public-assets`; update stored URLs and upload/download code.
- **Why blocked:** 267,214 objects totaling about 13.5 GB need a destination and migration window; no S3/R2 bucket, access keys, region, or CDN hostname was supplied.
- **Inventory:** `ad-images` 1 object / 1,970,226 bytes; `admin-uploads` 238 / 427,927,183 bytes; `legacy-public-assets` 266,975 / 13,040,329,530 bytes; the other two buckets were empty at inventory time.
- **Required:** versioned destination bucket, least-privilege credentials, region, CDN hostname, and migration window.
- **Affected:** images, PDFs, user documents, admin uploads, study material, and existing public asset URLs.
- **Can the app safely run without it:** yes while Supabase Storage remains available; no if those buckets are disabled.
- **Recommended action:** run the included resumable inventory/export flow, checksum every object, verify the CDN, then rewrite URLs.

### 5. Native Node Edge Function migration and third-party services

- **What is left:** port all remaining function calls from the checked-in Deno sources to native Node handlers and migrate provider secrets. The Node routes currently proxy these calls to deployed Supabase functions for compatibility.
- **Named calls found:** `admin-ai-generate`, `admin-blog-agent`, `admin-blog-ai-settings`, `admin-blog-studio`, `admin-data-cleaner`, `admin-invite-user`, `ai-counselor`, `bootstrap`, `cat-response-analyzer`, `check-eligibility`, `google-reviews`, `intent-export-csv`, `lp-dispatch-lead`, `phone-auth`, `predict-colleges`, `predict-lead-intent`, `process-lead`, `process-queue`, `purge-university-cache`, `receive-lead`, `save-lead`, `send-email`, `send-otp`, `study-otp`, `summarize-user-session`, `target-roadmap`, `test-api`, and `verify-domain`.
- **Why blocked:** source code is available, but required AI, SMS, email, Google, webhook, cron, and university-service secrets are not. Native replacements cannot be contract-tested without those services.
- **Required:** provider credentials, webhook allowlists, cron secrets, and test accounts/expected responses for each integration.
- **Affected:** AI tools, OTP, email, lead delivery, queues, scheduled jobs, Google reviews, admin automation, and university integrations.
- **Can the app safely run without it:** yes only while `SUPABASE_FUNCTIONS_FALLBACK_URL` is configured and the Supabase functions remain deployed.
- **Recommended action:** port and contract-test auth/OTP and lead processing first, then AI/admin integrations, retaining fallback until response parity is proven.

### 6. Realtime cutover

- **What is left:** replace Supabase Realtime channels with authenticated Node WebSockets or another MySQL-backed event transport.
- **Why blocked:** no production event infrastructure, hosting topology, or scale requirements were supplied.
- **Required:** transport choice, deployment support, authentication rules, and production channel inventory.
- **Affected:** live admin queues, dashboards, lead updates, and components using Supabase channels.
- **Can the app safely run without it:** yes while Supabase Realtime remains enabled; no after Supabase removal.
- **Recommended action:** inventory channels in staging, dual-publish through Node, compare events, then cut over subscribers.

### 7. Production end-to-end approval

- **What is left:** verify real login/OTP, all admin modules, uploads/downloads, every external integration, background schedules, redirects, production CORS, security, and load behavior.
- **Why blocked:** production-like services, accounts, infrastructure, and provider credentials are unavailable.
- **Required:** staging deployment, test accounts, all service credentials, monitoring, and a maintenance/cutover window.
- **Affected:** the whole application.
- **Can the app safely run without it:** local public flows are verified; production MySQL cutover is not approved.
- **Recommended action:** complete blockers 1 through 6, run acceptance tests, back up the source, apply the delta import, and switch traffic with rollback ready.

### 8. Non-blocking frontend lint warnings

- **What is left:** 101 historical warnings, primarily React Hook dependency review and Fast Refresh file-boundary organization.
- **Why not changed automatically:** adding dependencies can alter effect timing or create request loops, and splitting component files is unrelated to the data-platform migration. The actual Hook-order violations and all lint errors were fixed.
- **Required:** a focused component-by-component review with UI regression tests; no credential is required.
- **Affected:** listed frontend components and hooks only; build, TypeScript, tests, and lint all pass.
- **Can the app safely run without it:** yes. These warnings do not block local operation or build output.
- **Recommended action:** address Hook dependency warnings first, then extract shared exports for Fast Refresh.

## Exact completion order

1. Rotate the Supabase secret shared for this migration and store the replacement only in a secret manager.
2. Export the current live PostgreSQL catalog, resolve the duplicate `ceed` exam slug, and finish check/partial-index/workflow-function parity.
3. Provision staging MySQL and deploy the Node API with TLS and restricted CORS.
4. Run a fresh full import, apply `db:parity`, and compare per-table counts plus sampled checksums.
5. Configure and verify Supabase Auth compatibility in staging, then execute the selected identity migration.
6. Provision destination object storage, copy/checksum all 267,214 objects, verify CDN URLs, and switch storage code.
7. Port and contract-test Edge Functions with provider secrets; replace scheduled jobs and webhooks.
8. Implement and dual-test the Realtime replacement.
9. Run public, user, admin, OTP, upload, integration, security, and load tests.
10. Freeze source writes, run the final delta import, back up both systems, switch traffic, monitor, and retain rollback until stable.
11. Complete the non-blocking 101-warning frontend lint cleanup as a separate behavior-reviewed hardening pass.
