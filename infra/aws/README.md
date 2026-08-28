# AWS production infrastructure

`lightsail-production.yaml` defines the cost-controlled production stack in `ap-south-1`:

- a 1 GB, 2-vCPU Lightsail Node server
- a managed Lightsail MySQL database
- a private S3 media bucket with public access blocked
- Secrets Manager runtime and database secrets
- scoped IAM application credentials
- budget and CPU alarms

Cloudflare Pages serves the static frontend. The browser calls the CORS-restricted TLS-enabled AWS origin for `/v1`, `/auth`, and `/storage`; sitemap files remain available on the canonical `https://dekhocampus.com` domain.

The deployment workflow validates tests, lint, the production build, private-bucket policy, API health, MySQL connectivity, S3 delivery, and sitemap publication.
