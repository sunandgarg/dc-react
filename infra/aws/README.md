# AWS production deployment

The cost-optimized production setup runs the React site and Node API as two Docker containers on one `t3a.micro` EC2 instance with encrypted disk and swap. Nginx serves the built React assets and proxies `/v1`, `/auth`, `/storage`, and `/health` to Node on a private Docker network. Application data remains in encrypted RDS MySQL, with TLS required and the AWS RDS CA verified by Prisma. Only object bytes remain in Supabase Storage; the Supabase service key is read by the instance from AWS Secrets Manager and is never built into React.

## One-time bootstrap

Use AWS region `ap-south-1` unless there is an existing production region requirement.

1. In CloudFormation, create a stack from `infra/aws/bootstrap-stack.yaml` with IAM capabilities enabled.
2. If the AWS account already has the GitHub Actions OIDC provider, paste its ARN into `ExistingGitHubOidcProviderArn`.
3. Copy the stack outputs `DeploymentRoleArn` and the 12-digit AWS account ID into GitHub environment secrets `AWS_DEPLOY_ROLE_ARN` and `AWS_ACCOUNT_ID`.
4. Add GitHub production secrets `AUTH_JWT_SECRET` (at least 32 random characters) and `SUPABASE_STORAGE_SERVICE_KEY`.
5. Add repository variable `AWS_REGION=ap-south-1` and, after ACM validation, `ACM_CERTIFICATE_ARN`.
6. Run the **Deploy production to AWS** workflow manually. It deploys and verifies the low-cost EC2 server before removing the ECS service and Application Load Balancer. After the first live acceptance run, set repository variable `AWS_AUTO_DEPLOY=true` to enable production deployments for code changes on `main`.

The foundation stack retains the VPC, encrypted RDS MySQL 8.4 instance, backups, runtime secrets, and rollback task definition. The low-cost stack creates one EC2 instance, a static public IPv4 address, and Systems Manager access. Port 22 is not opened. The deployment keeps the old ECS/ALB path alive until the EC2 health check confirms MySQL and Supabase Storage configuration, then removes those two recurring-cost resources.

## DNS and TLS

The low-cost endpoint is initially HTTP on the static IP. Before public launch, point the domain through Cloudflare or another TLS reverse proxy to that IP. An ACM certificate cannot be attached directly to an EC2 instance. Do not move DNS until the static-IP URL passes `/health` and the production smoke tests.

## Required acceptance checks

- `/health` returns HTTP 200 with `database: mysql` and `storage: true`.
- Browser network calls for colleges, courses, exams, auth, admin, and forms use the site origin under `/v1` or `/auth`; no database query goes to Supabase.
- Uploads go to the site origin under `/storage/v1`, Node authorizes them, Supabase stores the bytes, and the resulting object URL is saved through `/v1/rest` in RDS.
- Anonymous users cannot write storage objects, normal users can only write their own avatar/documents, and only admins can write admin media.
- RDS backups are enabled, the instance is online in Systems Manager, and both Docker containers have restart policies.

## Cost and network note

The target is roughly USD 25-35 per month at low traffic, excluding Supabase, SMS, domain, taxes, and unusual data transfer. RDS remains private and accepts MySQL only from the shared application security group. The EC2 instance exposes only HTTP port 80, uses a static paid IPv4 address, and is managed through Systems Manager rather than SSH. This deliberately trades automatic multi-instance availability for a materially lower bill; RDS backups and CloudFormation rollback remain available.
