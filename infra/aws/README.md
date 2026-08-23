# AWS production deployment

This stack runs the React site and Node API as two containers in one ECS Fargate task. Nginx serves the built React assets on port 8080 and proxies `/v1`, `/auth`, `/storage`, and `/health` to Node on `127.0.0.1:8787`. Application data lives in encrypted RDS MySQL, with TLS required and the AWS RDS CA verified by Prisma. Only object bytes remain in Supabase Storage; the Supabase service key is injected into Node from AWS Secrets Manager and is never built into React.

## One-time bootstrap

Use AWS region `ap-south-1` unless there is an existing production region requirement.

1. In CloudFormation, create a stack from `infra/aws/bootstrap-stack.yaml` with IAM capabilities enabled.
2. If the AWS account already has the GitHub Actions OIDC provider, paste its ARN into `ExistingGitHubOidcProviderArn`.
3. Copy the stack outputs `DeploymentRoleArn` and the 12-digit AWS account ID into GitHub environment secrets `AWS_DEPLOY_ROLE_ARN` and `AWS_ACCOUNT_ID`.
4. Add GitHub production secrets `AUTH_JWT_SECRET` (at least 32 random characters) and `SUPABASE_STORAGE_SERVICE_KEY`.
5. Add repository variable `AWS_REGION=ap-south-1` and, after ACM validation, `ACM_CERTIFICATE_ARN`.
6. Run the **Deploy production to AWS** workflow manually. After the first live acceptance run, set repository variable `AWS_AUTO_DEPLOY=true` to enable production deployments for code changes on `main`.

The first deployment creates the VPC, ALB, ECS service, encrypted RDS MySQL 8.4 instance, backups, logs, runtime secrets, and an empty MySQL schema. It deliberately does not import the archived Supabase database snapshot.

## DNS and TLS

Request or import an ACM certificate for `dekhocampus.com` and `www.dekhocampus.com` in the same region as the ALB. Set `ACM_CERTIFICATE_ARN`, deploy, then point the two DNS records to the `LoadBalancerDnsName` CloudFormation output. Do not move DNS until the ALB URL passes `/health` and the production smoke tests.

## Required acceptance checks

- `/health` returns HTTP 200 with `database: mysql` and `storage: true`.
- Browser network calls for colleges, courses, exams, auth, admin, and forms use the site origin under `/v1` or `/auth`; no database query goes to Supabase.
- Uploads go to the site origin under `/storage/v1`, Node authorizes them, Supabase stores the bytes, and the resulting object URL is saved through `/v1/rest` in RDS.
- Anonymous users cannot write storage objects, normal users can only write their own avatar/documents, and only admins can write admin media.
- CloudWatch has both API and web logs, RDS backups are enabled, and the ECS deployment circuit breaker is active.

## Cost and network note

Fargate tasks receive public IPs so they can reach Supabase without a NAT Gateway, but their security group accepts inbound traffic only from the ALB. RDS is not public and accepts MySQL only from the task security group. For stricter network isolation, move tasks into private subnets and add a NAT Gateway before increasing the service beyond the initial cost-conscious configuration.
