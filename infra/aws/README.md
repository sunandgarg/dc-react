# AWS production infrastructure

For the reversible production API resize from the legacy 1 GB Lightsail
instance to the snapshot-created 2 GB generation, follow
[`LIGHTSAIL-2GB-MIGRATION.md`](./LIGHTSAIL-2GB-MIGRATION.md). Do not change the
legacy `InstanceBundleId` in place.

`lightsail-production.yaml` defines the cost-controlled production stack in `ap-south-1`:

- a retained 1 GB Lightsail API generation and an import-only 2 GB migration path
- a managed Lightsail MySQL database
- a private S3 media bucket with public access blocked
- Secrets Manager runtime and database secrets
- scoped IAM application credentials
- budget and CPU alarms

Cloudflare Pages serves the static frontend. The browser calls the CORS-restricted TLS-enabled AWS origin for `/v1`, `/auth`, and `/storage`; sitemap files remain available on the canonical `https://dekhocampus.com` domain.

The deployment workflow validates tests, lint, the production build, private-bucket policy, API health, MySQL connectivity, S3 delivery, and sitemap publication.
