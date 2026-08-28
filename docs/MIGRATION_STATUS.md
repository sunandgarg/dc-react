# Production migration status

Last verified: 2026-08-28

## Live architecture

- Cloudflare Pages serves the static React/Vite frontend at `https://dekhocampus.com`.
- The browser calls the TLS-protected Node API at `https://aws-origin.dekhocampus.com`.
- AWS Lightsail runs Node, Prisma, and the managed MySQL database in `ap-south-1`.
- A private AWS S3 bucket stores uploads, generated images, documents, sitemap files, and migrated legacy media.
- AWS Secrets Manager stores server-only authentication, SMS, AI, analytics-export, and application credentials.
- Supabase and DigitalOcean are not part of the production request path.

## Migration evidence

- The DigitalOcean MySQL migration produced a compressed `55.6 MiB` dump in private S3 before importing the production database into AWS.
- The completed storage migration verified `267,424` S3 objects totaling `13,705,204,499` bytes with zero migration errors.
- The migration rewrote `51,319` database rows from legacy public-storage URLs to provider-neutral S3 keys or the AWS media origin.
- The AWS deploy process scans all MySQL string and JSON fields for legacy storage URLs, verifies referenced S3 objects, normalizes valid references, and clears missing references.
- The latest successful AWS deployment reports `database=mysql`, `orm=prisma`, and `storage=s3` from `/health`.
- A production Lighthouse network capture loaded application data and media only from the Cloudflare site origin and AWS API origin; it made no Supabase or DigitalOcean request.
- The production frontend bundle contains no Supabase or DigitalOcean hostname.

## Retirement safety

The active site will continue to serve database content, authentication, API functions, uploads, and media if the old Supabase project or DigitalOcean resources are unavailable. Deleting those services would remove historical rollback copies, not a live dependency.

Before deleting a legacy account, independently download and checksum the private S3 database backup and storage migration manifest. Keep Supabase intact until that operational backup check is signed off. The repository's DigitalOcean backup workflow is retained only for this retirement task and is never used by the application.

Historical reports or migration history may still contain old provider names and URLs. They are reference material and are not bundled into the frontend or loaded by the backend.

## Verified production behavior

- Native Node JWT sessions and phone OTP authentication
- Node/Prisma/MySQL database reads, writes, RPC handlers, and durable work queues
- React to Node to private S3 upload flow with AWS media URLs saved in MySQL
- Fast2SMS, Gemini, OpenAI, and Clarity export credentials injected from AWS Secrets Manager
- Reversible production CRUD regression for core admin entities
- AI blog generation, FAQ cleanup, WebP cover upload, and exact smoke-test cleanup
- MySQL-generated sitemap index and six sitemap chunks published through the production domain
- Cloudflare immutable caching for fingerprinted frontend assets

## Remaining operations

- Add `CLOUDFLARE_PAGES_DEPLOY_HOOK_URL` to the GitHub `production` environment so the Cloudflare workflow can deploy automatically; direct authenticated Wrangler deployment currently works.
- Download and checksum the private S3 legacy backups before intentionally deleting Supabase or DigitalOcean resources.
- Rotate provider credentials that were pasted into chat history.
- Upload the exact custom blog cover template when available; the generated branded fallback is active and verified.
