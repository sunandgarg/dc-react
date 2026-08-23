# AWS and Supabase Storage production status

Last verified: 2026-08-23

## Current outcome

The checked-in React application sends database, auth, RPC, and function traffic to the Node API. Node uses Prisma and MySQL. Supabase remains only as object storage: React sends storage mutations to Node, Node authorizes and forwards the bytes with a server-only Supabase key, and application records save the resulting storage URL in MySQL.

No frontend code subscribes to Supabase Realtime. The three former subscriptions now poll Node/MySQL at controlled intervals. No unported Node function falls back to Supabase; it returns an explicit HTTP 501 response.

The AWS production stack is deployed on ECS Fargate behind an ALB, with encrypted RDS MySQL, Secrets Manager, ECR, CloudWatch logs, deployment rollback, and GitHub OIDC. The live ALB health check verifies the Node API, MySQL connection, and Supabase Storage configuration.

The live Supabase database was imported into RDS by a one-time ECS task. Supabase Storage objects were intentionally not copied: existing file/image URLs remain valid and application records in MySQL retain those URLs. The historical duplicate CEED slug was preserved with an ID-based legacy slug because MySQL correctly enforces the application's unique slug constraint.

The tracked `supabase/`, `db-export/`, `.do/`, and historical importer files remain reference or rollback material. The AWS workflow does not execute them except for the schema metadata/parity inputs required to create compatible empty MySQL tables, indexes, foreign keys, triggers, and views.

## Completed and verified

- [x] Preserved the React design and routes while making Node/Prisma/MySQL the only database runtime.
- [x] Removed browser database, auth, function, and realtime dependence on Supabase.
- [x] Added native access/refresh tokens, phone OTP state, rate limits, expiry, attempt limits, and fail-closed production SMS behavior.
- [x] Added native Node handlers for `send-otp`, `phone-auth`, `bootstrap`, and `save-lead`.
- [x] Routed uploads React -> Node -> Supabase Storage and database URL writes React -> Node -> MySQL.
- [x] Restricted normal users to their own `user-documents` and `user-avatars` paths; restricted admin media buckets to administrators.
- [x] Added server-side upload MIME and 20 MiB limits; kept the Supabase service key out of React.
- [x] Streamed Node responses to clients instead of buffering entire storage downloads in server memory.
- [x] Replaced the remaining Supabase Realtime subscriptions with Node/MySQL polling.
- [x] Added two-container AWS packaging: Nginx/React and Node/Prisma share an ECS Fargate task and communicate over localhost.
- [x] Added CloudFormation for VPC, security groups, ALB/TLS listener, ECS, encrypted RDS, required/verified database TLS, backups, Secrets Manager, CloudWatch, health checks, and deployment rollback.
- [x] Added ECR and GitHub OIDC bootstrap plus a verified-before-deploy GitHub Actions workflow.
- [x] Added a runtime database initializer that creates the Prisma schema and applies compatible MySQL parity.
- [x] Imported the live Supabase database into AWS RDS with a successful one-time ECS task; no database traffic requires Supabase at runtime.
- [x] Moved the active Fast2SMS provider configuration to MySQL and its API credential to AWS Secrets Manager.
- [x] Disabled the old public sitemap as an AWS build seed, so production entity URLs come only from fresh RDS content.
- [x] Strengthened `/health` so ECS only reports healthy after MySQL answers; it also reports whether storage is configured.
- [x] Verified 114 frontend unit tests and 5 backend database/storage-policy tests.
- [x] Verified TypeScript, Prisma generation, production Vite build, and ESLint with zero errors (101 existing non-blocking warnings).
- [x] Previously verified 33 runnable Playwright checks across Chromium, Firefox, and WebKit; 9 authenticated/data-dependent cases require production fixtures.
- [x] Previously verified a disposable empty MySQL database with 150 tables, 337 indexes, 100 triggers, 2 views, and all 149 REST resources.

## Not yet production-complete

### 1. AWS account deployment

- **Left:** create the bootstrap and application CloudFormation stacks, push images, validate ALB health, attach ACM/DNS, and run live regression.
- **Blocked by:** the signed-in AWS account (`DekhoCampus`, account `659681702447`) currently opens CloudFormation at the AWS **Complete your account setup** page. AWS says registration/payment verification is unfinished or the free account plan limits the required service.
- **Required:** finish AWS registration and payment verification, or upgrade the AWS account plan, then reopen CloudFormation. The production stack should be created in `ap-south-1` as documented in `infra/aws/README.md`.
- **Safety:** no AWS resource or recurring AWS charge has been created by this work.

### 2. Production secrets and providers

- **Required for core go-live:** `SUPABASE_STORAGE_SERVICE_KEY`, `AUTH_JWT_SECRET`, and an active Fast2SMS account/approved sender-template configuration.
- **Required for optional integrations:** Google OAuth, email, AI providers, Google reviews, university APIs, lead-distribution endpoints, and webhook/cron verification secrets.
- **Behavior without them:** browsing and database features can run; uploads or provider-backed features fail closed with explicit errors.

### 3. Native function handlers

These UI-invoked handlers are not native Node implementations yet: `admin-ai-generate`, `admin-blog-agent`, `admin-blog-ai-settings`, `admin-blog-studio`, `admin-data-cleaner`, `admin-invite-user`, `check-eligibility`, `lp-dispatch-lead`, `predict-colleges`, `predict-lead-intent`, `process-lead`, `process-queue`, `purge-university-cache`, `send-email`, `summarize-user-session`, `target-roadmap`, `test-api`, and `verify-domain`. Additional legacy Supabase functions remain archived but are not called by the main React paths.

Most need external credentials, successful/error contract examples, and provider test accounts. The invitation flow also needs an approved native email/phone onboarding contract because password login was removed with Supabase Auth. Until ported, their individual screens cannot be called fully functional and return HTTP 501 from Node.

### 4. First administrator and content

The new AWS database intentionally starts empty. An intended administrator must complete one native phone login, then receive an `admin` row in `user_roles`. Homepage and directory content must be newly entered or separately approved for import. Without this, the service can be healthy but colleges, courses, and exams are empty.

### 5. Production acceptance

After deployment, verify `/health`, TLS/CORS, empty-state public pages, login/refresh/logout, first-admin authorization, file upload/delete, direct public media delivery, database URL persistence, CloudWatch logs, RDS backups, and deployment rollback. Then run the authenticated/data-dependent Playwright cases and provider contract tests before moving DNS.

## Exact next steps

1. Complete AWS registration/payment verification or upgrade the AWS account plan so CloudFormation, ECS, and RDS are available.
2. Create `infra/aws/bootstrap-stack.yaml` in `ap-south-1`; place its role/account outputs in the GitHub production environment.
3. Add `AUTH_JWT_SECRET` and `SUPABASE_STORAGE_SERVICE_KEY`; configure ACM.
4. Run the AWS deployment workflow and verify the ALB URL before changing DNS.
5. Configure SMS, create the first native user, and grant the first admin role.
6. Enter approved fresh content and run public/admin/upload regression.
7. Port and contract-test each provider-backed function that is required for launch.
8. Move DNS only after the live acceptance checklist passes.
