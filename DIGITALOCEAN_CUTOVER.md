# DigitalOcean production cutover

The current staging application is `https://test.dekhocampus.com`. The final
production hostname is `https://dekhocampus.com`.

## Current state

- DigitalOcean hosts the React frontend, Node API, and managed MySQL database.
- Supabase is used only for file and image object storage.
- Cloudflare has an apex-only cache rule prepared for `dekhocampus.com`.
- The cache rule excludes `/api`, `/v1`, `/admin`, `/auth`, `/storage`, and
  `/health` paths so authenticated and mutable traffic is never cached.

## Cutover sequence

1. Complete the staging regression checklist and take a managed MySQL backup.
2. Add `dekhocampus.com` and `www.dekhocampus.com` to the DigitalOcean app.
3. Wait for DigitalOcean to validate both hostnames and provision TLS.
4. Change the Cloudflare apex and `www` records to the targets shown by
   DigitalOcean, with proxying enabled.
5. Keep `test.dekhocampus.com` available for post-release verification.
6. Verify `/health`, login, OTP, admin writes, uploads, public entity pages,
   analytics, sitemap, and redirects on the apex hostname.
7. Purge only the Cloudflare HTML cache after a successful deployment.

Do not run the full `deploy-digitalocean.yml` workflow for an ordinary code
release because it performs an AWS-to-DigitalOcean database copy. Use
`redeploy-digitalocean.yml`, which redeploys code without touching MySQL.
