# MySQL migration status

Last verified: 2026-08-22

## Current outcome

The unchanged React/Vite user interface now has a selectable Node.js, Prisma, and MySQL data path. A full point-in-time export of every readable Supabase REST definition was loaded into an isolated local MySQL 9.6 database. Public content pages run against the local Node API; Supabase remains a compatibility dependency for Auth, Storage, Realtime, and Edge Functions.

This state is safe for local development and public-page verification. It is **not safe for a production cutover away from Supabase** until every blocked item below is completed.

## Completed and verified

- [x] Preserved the existing React component tree, styling, routes, and responsive UI.
- [x] Added environment switches: `VITE_USE_MYSQL`, `VITE_USE_SUPABASE`, and `VITE_API_URL`.
- [x] Routed existing `supabase.from(...)` requests through the Node API without rewriting individual pages.
- [x] Generated 149 Prisma model definitions from the live Supabase REST schema.
- [x] Imported 58,669 physical-table rows into local MySQL with zero importer errors.
- [x] Preserved the two read-only view result sets in the export; the views are listed as blocked below.
- [x] Implemented compatible GET, HEAD, POST, PATCH, DELETE, filtering, ordering, ranges, counts, one-level relationships, JSON decoding, defaults, and object responses.
- [x] Implemented MySQL RPC handlers for `has_role`, `clear_featured_rank`, `set_featured_rank`, `set_ai_emergency_stop`, `intent_merge_visitor`, `increment_url_clicks`, `is_user_approved`, `search_directory_fast`, and `get_data_cleaning_coverage`.
- [x] Added anonymous public-table allowlists, authenticated row ownership for user tables, and admin checks for private tables/RPCs.
- [x] Added Docker, local Node server, Prisma generation/import scripts, and AWS SAM configuration.
- [x] Verified health, public reads, denied private reads, search RPC, insert/object response, cleanup, and nested relationship hydration against local MySQL.
- [x] Verified the homepage, college directory, course directory, and exam directory in Chrome against Node/MySQL. The college directory rendered 24 imported records including ICFAI Business School Gurgaon, JECRC University, and Masters' Union.
- [x] Passed 114 frontend tests across 26 test files.
- [x] Passed TypeScript validation with `tsc --noEmit`.
- [x] Completed the production Vite build and post-build metadata/sitemap tasks.
- [x] Generated the live production sitemap successfully: 237,993 URLs across six sitemap files.
- [x] Confirmed no Supabase secret key is present in tracked source files.
- [x] Backend production dependency audit reports zero vulnerabilities.
- [x] Applied all non-breaking frontend `npm audit` fixes, reducing the inherited production audit from 13 findings to 5.

## Completed but requiring production verification

- [~] Database import is point-in-time. A final delta export and write freeze are required at cutover.
- [~] Prisma/MySQL types, primary keys, JSON values, timestamps, and discovered relationship metadata are generated. PostgreSQL secondary indexes, unique constraints, check constraints, triggers, and RLS policies are not fully represented by the REST OpenAPI export and require a direct PostgreSQL schema dump or manual parity review.
- [~] The Node API validates Supabase JWTs during the compatibility phase. Production latency, token refresh, admin access, and all user-owned dashboard flows require staging tests with real accounts.
- [~] Docker and AWS deployment configuration are prepared but have not been deployed because no production infrastructure/database credentials were provided.

## Remaining work and blockers

### 1. Production MySQL database and deployment

- **What is left:** provision production MySQL, apply the Prisma schema, restore the exported data, run a final delta import, deploy the Node API, and configure the frontend production API URL.
- **Why blocked:** no production `DATABASE_URL`, MySQL host/user/password/TLS settings, deployment account, domain, or DNS permission was supplied.
- **Required:** production MySQL credentials, chosen hosting target, API hostname, TLS policy, and deployment permission.
- **Affected:** all `/v1/rest/*` and `/v1/rest/rpc/*` routes and the production frontend environment.
- **Can the app safely run now:** yes only locally or with the existing Supabase production path; no for a production MySQL cutover.
- **Recommended action:** provision a staging MySQL instance first, deploy this API, and execute the full regression checklist before production.

### 2. Database schema parity

- **What is left:** recreate and verify secondary indexes, unique constraints, foreign-key enforcement, check constraints, triggers, and functions that were not exposed in the REST OpenAPI description.
- **Why blocked:** the supplied REST access exposes records and field descriptions, not a complete PostgreSQL catalog dump.
- **Required:** a `pg_dump --schema-only` export or direct database connection with catalog-read permission.
- **Affected:** write integrity, performance, background workflows, and admin mutations.
- **Can the app safely run now:** local verification is safe; production writes are not approved without parity review.
- **Recommended action:** export the source schema, translate it to MySQL migrations, benchmark the largest tables, then rerun import verification.

### 3. Two PostgreSQL views

- **What is left:** create MySQL equivalents of `college_editorial_completion_progress` and `leads_daily_business_rollup`.
- **Why blocked:** the REST schema exposes each view's result columns but not its SQL definition.
- **Required:** the PostgreSQL `CREATE VIEW` definitions or direct database catalog access.
- **Affected:** editorial completion reporting and daily lead business reporting.
- **Can the app safely run now:** public pages can; those two reports cannot use MySQL yet.
- **Recommended action:** obtain the view SQL, translate it, add fixtures, and compare source/target results.

### 4. Supabase Auth migration

- **What is left:** replace Supabase Auth, migrate identities, configure Google OAuth, recreate password/OTP flows, and remove JWT validation against Supabase.
- **Why blocked:** the Auth API returned one user record but does not expose recoverable passwords or third-party OAuth secrets.
- **Required:** an identity-provider decision, OAuth client credentials, email/SMS provider credentials, redirect URLs, and a user migration/reset plan.
- **Affected:** sign-in, onboarding, user dashboards, admin access, invitations, phone OTP, and protected Node routes.
- **Can the app safely run now:** yes while Supabase Auth remains enabled; no if Supabase is removed.
- **Recommended action:** keep Supabase Auth during staging, choose the replacement, migrate accounts with a controlled reset/link flow, then change Node JWT validation.

### 5. Supabase Storage migration

- **What is left:** copy and verify five buckets: `ad-images`, `user-documents`, `admin-uploads`, `study-material`, and `legacy-public-assets`, then update stored URLs and upload/download code.
- **Why blocked:** the inventory contains 267,214 objects totaling about 13.5 GB; no destination S3/R2 bucket, access keys, region, CDN hostname, or migration window was supplied.
- **Inventory:** `ad-images` 1 object / 1,970,226 bytes; `admin-uploads` 238 / 427,927,183 bytes; `legacy-public-assets` 266,975 / 13,040,329,530 bytes; the other two buckets were empty at inventory time.
- **Affected:** images, PDFs, user documents, admin uploads, study material, and existing public asset URLs.
- **Can the app safely run now:** yes while Supabase Storage remains available; no if its buckets are disabled.
- **Recommended action:** provision versioned S3/R2 storage, run the included inventory/export tool in resumable batches, checksum objects, then rewrite URLs after CDN verification.

### 6. Edge Functions and third-party services

- **What is left:** port the remaining named function calls to native Node handlers and migrate their provider secrets. Current Node routes proxy them to Supabase for compatibility.
- **Named calls found:** `admin-ai-generate`, `admin-blog-agent`, `admin-blog-ai-settings`, `admin-blog-studio`, `admin-data-cleaner`, `admin-invite-user`, `ai-counselor`, `bootstrap`, `cat-response-analyzer`, `check-eligibility`, `google-reviews`, `intent-export-csv`, `lp-dispatch-lead`, `phone-auth`, `predict-colleges`, `predict-lead-intent`, `process-lead`, `process-queue`, `purge-university-cache`, `receive-lead`, `save-lead`, `send-email`, `send-otp`, `study-otp`, `summarize-user-session`, `target-roadmap`, `test-api`, and `verify-domain`.
- **Why blocked:** function-specific AI, SMS, email, Google, webhook, cron, and university API credentials were not supplied, and the Supabase dashboard account could not open the target project.
- **Required:** all provider credentials, webhook allowlists, cron secrets, expected production behavior, and access to source function secrets/configuration.
- **Affected:** AI tools, OTP, email, lead delivery, queues, scheduled jobs, Google reviews, admin automation, and university integrations.
- **Can the app safely run now:** yes while `SUPABASE_FUNCTIONS_FALLBACK_URL` is configured and Supabase functions remain deployed; no without that fallback.
- **Recommended action:** port and contract-test one dependency group at a time, starting with auth/OTP and lead processing, while retaining fallback until parity is proven.

### 7. Realtime cutover

- **What is left:** replace Supabase Realtime subscriptions with WebSockets or another event system backed by MySQL.
- **Why blocked:** no production event transport, hosting topology, or scale requirements were supplied.
- **Required:** WebSocket/event-bus choice, deployment support, authentication rules, and channel inventory validation.
- **Affected:** live admin queues, dashboards, lead updates, and any components using Supabase channels.
- **Can the app safely run now:** yes while Supabase Realtime remains enabled; no after Supabase removal.
- **Recommended action:** inventory channels in staging, implement authenticated Node WebSockets, then dual-publish and compare events before cutover.

### 8. Production end-to-end approval

- **What is left:** test real login/OTP, all admin modules, uploads/downloads, every Edge Function integration, background schedules, redirects, and production domain CORS against staging and production-like data.
- **Why blocked:** production services and provider credentials are unavailable in this execution.
- **Required:** staging deployment, test accounts, service credentials, and a maintenance/cutover window.
- **Affected:** whole application.
- **Can the app safely run now:** local public flows are verified; production cutover is not approved.
- **Recommended action:** complete blockers 1 through 7, run the acceptance matrix, take a source backup, run the delta import, then switch traffic with a documented rollback.

### 9. Existing repository lint baseline

- **What is left:** reduce or formally baseline the existing ESLint backlog. The full repository lint currently reports 2,034 errors and 106 warnings, dominated by pre-existing `no-explicit-any` findings in frontend and Supabase function code.
- **Why blocked:** repairing more than two thousand pre-existing type/style findings is a separate frontend-wide refactor and would conflict with the requirement to preserve the current frontend behavior during this migration.
- **Required:** approval for a dedicated lint/type-hardening pass, preferably module-by-module with regression tests.
- **Affected:** many existing frontend, script, and legacy Supabase function files; this is not limited to the migration files.
- **Can the app safely run now:** the application builds and 114 tests pass, so this does not block local execution, but CI must not claim a clean lint run.
- **Recommended action:** establish a changed-files lint gate immediately, then burn down the historical backlog separately.

### 10. Frontend dependency major-version security upgrades

- **What is left:** resolve five remaining production audit findings in `esbuild`/Vite, React Router, and Sharp/libvips.
- **Why blocked:** npm can only resolve them with forced major-version upgrades to Vite 8, React Router 7, and Sharp 0.35, which can break the preserved frontend and require a dedicated compatibility migration.
- **Required:** approval for major upgrades plus router, build, image-processing, browser, and deployment regression testing.
- **Affected:** frontend routing, development/build tooling, and legacy image migration scripts.
- **Can the app safely run now:** local build/tests pass, but the audit is not clean and production risk must be reviewed.
- **Recommended action:** upgrade each dependency family in a separate tested change; do not use `npm audit fix --force` blindly.

## Exact completion order

1. Rotate the Supabase secret shared during migration and store the replacement only in a secret manager.
2. Obtain a complete PostgreSQL schema dump and finish MySQL constraints, indexes, triggers, and both views.
3. Provision staging MySQL and deploy the Node API with TLS and restricted CORS.
4. Run a fresh full import, then compare per-table counts and sampled checksums.
5. Configure and verify Supabase Auth compatibility in staging.
6. Provision destination object storage, migrate/checksum all 267,214 objects, and update URLs.
7. Port Edge Functions and provider secrets, then replace scheduled jobs and webhooks.
8. Implement and dual-test the Realtime replacement.
9. Establish a changed-files lint gate and schedule the existing lint backlog cleanup.
10. Upgrade Vite/esbuild, React Router, and Sharp with focused regression tests.
11. Run public, user, admin, OTP, upload, integration, security, and load tests.
12. Freeze source writes, run the final delta import, back up both systems, switch frontend/API traffic, monitor, and retain rollback until stable.
