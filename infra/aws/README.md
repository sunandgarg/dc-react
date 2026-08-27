# AWS production infrastructure

`lightsail-production.yaml` defines the cost-controlled production stack in `ap-south-1`:

- a 1 GB, 2-vCPU Lightsail Node server
- a managed Lightsail MySQL database
- a private S3 media bucket with public access blocked
- Secrets Manager runtime and database secrets
- scoped IAM application credentials
- budget and CPU alarms

Cloudflare Pages serves the frontend. Its Worker proxies `/v1`, `/auth`, `/storage`, `/health`, and sitemap paths to the TLS-enabled AWS origin. Public browser traffic is canonicalized to `https://dekhocampus.com`.

The deployment workflow validates tests, lint, the production build, private-bucket policy, API health, MySQL connectivity, S3 delivery, and sitemap publication.
