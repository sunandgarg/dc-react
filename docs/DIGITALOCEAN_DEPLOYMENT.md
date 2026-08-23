# DigitalOcean deployment

The repository is prepared for one App Platform app named `dc-react` in the Bangalore region. It contains the React static site, a 512 MB Node/Prisma API service, and a 1 GB managed MySQL cluster named `dc-react-mysql`. The manual DigitalOcean workflow copies the current AWS MySQL database through the existing AWS application host, verifies a representative row count, and preserves AWS as rollback. The existing Supabase project is retained only for file and image storage.

## Required encrypted runtime variables

The GitHub `production` environment supplies these as encrypted runtime variables:

- `AUTH_JWT_SECRET`: at least 32 random bytes; rotating it signs every user out.
- `SMS_FAST2SMS_API_KEY`: used for production OTP delivery.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: required only to enable Google sign-in.
- `SUPABASE_STORAGE_SERVICE_KEY`: the existing Supabase project's secret/service-role key, used only by the Node storage proxy.
- Provider credentials used by the unported function list in `docs/MIGRATION_STATUS.md`.

`DATABASE_URL` is injected from the managed MySQL binding in `.do/app.yaml`. `SUPABASE_STORAGE_URL` and the public Vite storage URL are already set to the existing project URL. The backend container applies the Prisma schema and MySQL parity objects before starting the HTTP server.

## Routing

The App Platform ingress sends `/v1`, `/auth`, `/storage`, and `/health` to Node. Every other path goes to the React static site, with `index.html` as the SPA fallback. Database, auth, and function calls use the same app origin. Storage mutations pass through Node with native authorization; public image URLs point directly to Supabase Storage. No Supabase key is exposed in the browser.

## First administrator

The migrated native users and role rows remain in MySQL, including the production administrator assignments.
