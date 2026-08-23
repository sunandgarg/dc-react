# DigitalOcean deployment

The repository is prepared for one App Platform app named `dc-react` in the Bangalore region. It contains the React static site, the Node/Prisma API, and an attachment to a new managed MySQL cluster named `dc-react-mysql`. The database starts empty; no Supabase database export or import command runs during deployment. The existing Supabase project is retained only for file and image storage.

## Required encrypted runtime variables

Set these on the `api` component before the first production deployment:

- `AUTH_JWT_SECRET`: at least 32 random bytes; rotating it signs every user out.
- `SMS_WEBHOOK_URL` and optionally `SMS_WEBHOOK_BEARER_TOKEN`: required for production OTP delivery.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: required only to enable Google sign-in.
- `SUPABASE_STORAGE_SERVICE_KEY`: the existing Supabase project's secret/service-role key, used only by the Node storage proxy.
- Provider credentials used by the unported function list in `docs/MIGRATION_STATUS.md`.

`DATABASE_URL` is injected from the managed MySQL binding in `.do/app.yaml`. `SUPABASE_STORAGE_URL` and the public Vite storage URL are already set to the existing project URL. The backend container applies the Prisma schema and MySQL parity objects to the fresh database before starting the HTTP server.

## Routing

The App Platform ingress sends `/v1`, `/auth`, `/storage`, and `/health` to Node. Every other path goes to the React static site, with `index.html` as the SPA fallback. Database, auth, and function calls use the same app origin. Storage mutations pass through Node with native authorization; public image URLs point directly to Supabase Storage. No Supabase key is exposed in the browser.

## First administrator

After the intended administrator completes phone login, insert an `admin` row for that new native user ID in `user_roles`. Do not reuse an old Supabase user ID.
