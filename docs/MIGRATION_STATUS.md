# DigitalOcean and Supabase Storage migration status

Last verified: 2026-08-23

## Current outcome

The checked-in React application uses the Node API for data and auth, and the Node API uses Prisma/MySQL. Supabase is retained only for file and image storage. Storage mutations pass through Node with native authorization and a server-only Supabase service key, while public asset URLs use Supabase's CDN directly. Unported function handlers and realtime behavior remain explicit gaps described below; they do not fall back to Supabase.

The new stack is **not live on the public domain yet**. On 2026-08-23, `https://dekhocampus.com/` was still served by Apache/Next.js at `13.235.138.165`. The new stack's `/health`, `/v1/status`, and `/v1/rest/*` routes returned the old site's Next.js 404 page. Consequently, the colleges, courses, exams, and counts currently visible on the public domain come from that older deployment, not this repository's Node/MySQL runtime.

The local MySQL database still contains the 2026-08-22 point-in-time import used to prove migration parity. Local counts are 13,016 colleges, 878 courses, and 240 exams. They are local MySQL rows, not live Supabase reads. A newly provisioned DigitalOcean database will be empty because the deployment setup applies schema/parity only and never runs the archived importer.

The checked-in `supabase/`, `db-export/`, and historical migration utilities remain as read-only source/reference material. They are not called by the production build, server, database setup, or DigitalOcean deployment.

Per the latest direction, the DigitalOcean MySQL database will start empty. `npm run db:setup` no longer imports the prior Supabase export; the old importer is available only through the explicitly named `db:import:supabase-archive` command.

## Completed and verified

- [x] Preserved the existing React routes, components, styling, and responsive frontend.
- [x] Made Node/Prisma/MySQL the only frontend runtime target; removed backend-selection switches and every hard-coded Supabase project fallback.
- [x] Removed tracked Supabase project credentials and the HTML preconnect/dns-prefetch.
- [x] Removed Node-to-Supabase Auth validation and Edge Function proxying.
- [x] Added native HMAC-signed access tokens, rotating refresh tokens, native phone identities, OTP challenge storage, rate limits, expiry, attempt limits, and fail-closed production SMS configuration.
- [x] Added native-authorized uploads/list/download/delete proxied to Supabase Storage without exposing the service key to the browser.
- [x] Added native Node handlers for `send-otp`, `phone-auth`, `bootstrap`, and `save-lead`.
- [x] Retained the existing query-builder surface for frontend stability while routing its REST, Auth, Storage, and Function network requests only to Node.
- [x] Added three Prisma auth tables and verified schema/client generation.
- [x] Verified locally: health, MySQL access, OTP creation/exchange, session issuance, authenticated upload, and public download.
- [x] Changed the default database setup to schema/parity only, with no old-data import.
- [x] Added a DigitalOcean App Platform spec for the React static site, Node service, new managed MySQL attachment, health checks, routing, and automatic deploys from `sunandgarg/dc-react:main`.
- [x] Fixed the App Platform Docker build context so the production parity step includes the tracked PostgreSQL schema reference and all recovered indexes.
- [x] Changed sitemap entity discovery from Supabase Database to the Node/MySQL API; verified 237,993 URLs from the local imported MySQL snapshot.
- [x] Verified a disposable empty MySQL database: 150 base tables, 337 indexes, 100 triggers, 2 views, all 149 REST resources, and native OTP/login/user/refresh/logout flows.
- [x] Verified 114/114 Vitest tests, TypeScript, ESLint with zero errors, Prisma generation, and the production Vite build.
- [x] Installed the missing Playwright test runner and Chromium, Firefox, and WebKit runtimes. All 33 runnable desktop/mobile checks pass across the three configured projects; 9 authenticated or data-dependent cases skip without their fixtures.
- [x] Added production deployment instructions and required secret inventory in `docs/DIGITALOCEAN_DEPLOYMENT.md`.

## Completed but needing production verification

- [~] Native auth works locally. Production OTP requires an SMS webhook and Google sign-in requires a new Google OAuth client.
- [~] The Supabase Storage proxy and public URL split are implemented; production verification requires the existing project's storage service key.
- [~] The clean Prisma schema is ready, but it has not yet been applied to a new DigitalOcean MySQL cluster.
- [~] The App Platform configuration is prepared, but no paid DigitalOcean resource has been created yet.

## Remaining work and blockers

### 1. Paid DigitalOcean resources

- **What is left:** create `dc-react-mysql` and the `dc-react` App Platform app; attach them to the existing `DekhoCampus` project. No DigitalOcean Spaces bucket is needed.
- **Why not completed:** no `doctl` authentication is available, and Codex cannot access the signed-in Chrome session because the ChatGPT browser extension/bridge is not installed or enabled in that profile. The previously observed checkout also creates recurring paid resources.
- **Required:** enable the Codex browser extension in the signed-in Chrome profile and confirm the current recurring total shown before creation.
- **Affected:** production database, public deployment, and durable uploads.
- **Can the app safely run without it:** yes locally; no production URL or production database exists yet.
- **Recommended next action:** approve the cost, then create MySQL first and App Platform second.

### 2. Provider credentials

- **What is left:** configure the Supabase Storage server key, production SMS delivery, Google OAuth, email, AI providers, Google reviews, university APIs, and cron/webhook verification.
- **Why not completed:** these credentials are not present in the repository or DigitalOcean account configuration and cannot be inferred.
- **Required:** `SUPABASE_STORAGE_SERVICE_KEY`, `SMS_WEBHOOK_URL` (and optional bearer token), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and feature-specific provider secrets.
- **Affected:** uploads, phone delivery in production, Google login, AI tools, email, reviews, lead distribution, queues, and university integrations.
- **Can the app safely run without it:** public browsing and direct database features can run; the named provider-backed features fail closed with explicit errors.
- **Recommended next action:** add each value as an encrypted DigitalOcean runtime variable, never as a `VITE_` variable or committed file.

### 3. Unported native function handlers

- **What is left:** native Node handlers for `admin-ai-generate`, `admin-blog-agent`, `admin-blog-ai-settings`, `admin-blog-studio`, `admin-data-cleaner`, `admin-invite-user`, `ai-counselor`, `cat-response-analyzer`, `check-eligibility`, `google-reviews`, `intent-export-csv`, `lp-dispatch-lead`, `predict-colleges`, `predict-lead-intent`, `process-lead`, `process-queue`, `purge-university-cache`, `receive-lead`, `send-email`, `study-otp`, `summarize-user-session`, `target-roadmap`, `test-api`, and `verify-domain`.
- **Why not completed:** most handlers depend on missing external-provider credentials and contract test accounts. They are not proxied to Supabase anymore.
- **Required:** the credentials in blocker 2 plus example successful/error responses for each external integration.
- **Affected:** AI/admin automation, eligibility/prediction, external lead routing, bulk queues, email, study OTP, domain verification, and university API tests.
- **Can the app safely run without it:** the application remains isolated from Supabase, but these individual features return HTTP 501 and are not functionally complete.
- **Recommended next action:** port and contract-test `study-otp`, `receive-lead`, and `process-lead` first; then prediction/AI; then admin automation.

### 4. Realtime behavior

- **What is left:** replace the remaining compatibility channel calls with Node WebSocket or SSE events backed by MySQL.
- **Why not completed:** no production event topology or scaling requirement has been selected.
- **Required:** decide WebSocket versus SSE and provide the expected production concurrency.
- **Affected:** live admin logs, profile-change refresh, and other auto-updating admin views.
- **Can the app safely run without it:** yes for normal request/refresh behavior; live updates require manual refresh.
- **Recommended next action:** add authenticated SSE for the current small channel inventory, then test reconnect and authorization behavior.

### 5. First administrator and clean content

- **What is left:** create the first native user/admin role and enter or seed fresh site content.
- **Why not completed:** the user explicitly requested no import from the earlier database, and no new administrator phone number/content seed was supplied.
- **Required:** the intended admin signs in once, then their new user ID is assigned `admin` in `user_roles`; content can then be entered through admin pages or a separately approved seed.
- **Affected:** admin access and every content directory in the intentionally empty database.
- **Can the app safely run without it:** the deployment can run, but directories will be empty and nobody will have admin access.
- **Recommended next action:** after deployment, perform one phone login, assign that user the admin role, and create the minimum homepage/navigation content.

### 6. Production acceptance

- **What is left:** verify the deployed health route, schema creation, empty-state pages, native login/refresh/logout, admin authorization, Supabase Storage uploads, CORS, every configured provider feature, and deploy-on-push. Run browser regression on desktop and mobile with production fixtures.
- **Why not completed:** the paid infrastructure and provider credentials above do not exist yet.
- **Required:** blockers 1, 2, and 5, plus an authenticated administrator storage-state fixture and deterministic clean-database content fixtures for the currently skipped cases.
- **Affected:** the complete production application.
- **Can the app safely run without it:** local verification is safe; production approval is not possible yet.
- **Recommended next action:** run the acceptance checklist immediately after the first deployment before attaching the public domain.

## Exact completion order

1. Confirm the recurring DigitalOcean cost.
2. Create `dc-react-mysql` in Bangalore and attach it to `DekhoCampus`.
3. Create the `dc-react` App Platform app from `main`, add `AUTH_JWT_SECRET` and `SUPABASE_STORAGE_SERVICE_KEY` as encrypted variables, and deploy.
4. Verify `/health`, Prisma schema creation, and a Supabase Storage upload/public read.
5. Configure SMS; sign in once; assign the new user ID the first admin role.
6. Configure Google OAuth and remaining provider credentials.
7. Port and contract-test the 24 remaining function handlers in the order listed above.
8. Add native realtime transport and verify reconnect/authorization.
9. Add clean production E2E fixtures, run the complete production acceptance suite, then attach DNS/domain traffic.
