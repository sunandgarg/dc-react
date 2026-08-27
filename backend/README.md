# DekhoCampus Node API

This service provides the native AWS production API for DekhoCampus. It uses Prisma with MySQL, native JWT sessions, Fast2SMS OTP delivery, Gemini and OpenAI integrations, and private S3 object storage.

## Local setup

```sh
cp backend/.env.example backend/.env.local
npm --prefix backend ci
npm --prefix backend run prisma:generate
npm --prefix backend run db:push
npm --prefix backend run db:parity
npm --prefix backend run dev
```

## Routes

- `GET /health`
- `/v1/rest/:table` for table reads and mutations
- `/v1/rest/rpc/:function` for native MySQL RPC handlers
- `/v1/functions/:function` for Node function handlers
- `/auth/v1/*` for native sessions
- `/storage/v1/*` for authorized S3 operations

Anonymous access is allowlisted for public content and submission tables. Protected resources require a valid native access token, and administrator operations require an `admin` role in MySQL.

Production credentials are injected from AWS Secrets Manager into `/etc/dc-react.env`. Do not place database, provider, or storage credentials in browser variables.
