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

## Inline document viewer PDFs

The shared rich-text editor accepts one PDF (20 MB, at most 500 pages) or legacy
image pages. Authenticated editorial uploads use create-only paths under
`admin-uploads/editor/documents/`. The API validates PDF structure and rejects
encrypted files and embedded scripts/active content, then compresses object
streams in an isolated worker (15-second limit, at most two concurrent jobs).
Optimization is lossless, retains forms, never increases file size, and leaves
digitally signed PDFs byte-for-byte unchanged. It does not downsample scanned
images, so already compressed scans may not shrink.

The PDF bytes remain in encrypted S3 object storage, following existing media
architecture. The viewer title and permanent PDF URL are persisted in the
entity's MySQL rich-content field when the editor saves the article, college,
course or exam. A cancelled edit can leave an unreferenced upload, like existing
image uploads; this flow does not delete existing files. The public PDF viewer
loads PDF.js only after the reader opens it and uses the existing public storage
API for uploaded files so CDN CORS is not required. No schema migration or new
production secret is needed; deploy both frontend and backend together.
The AWS deployment installs the scoped nginx upload snippet with a 20 MB body
limit for this authenticated upload path; unrelated API limits are unchanged.

## Optional Redis public-content cache

Set server-only `REDIS_URL` to an existing Redis endpoint to enable caching. Leave
it empty to retain the existing MySQL-only behavior. Use `rediss://` with TLS for
managed Redis and a private network/ACL; never open Redis to the public internet.
Use a separate `REDIS_CACHE_PREFIX` for each environment or database.

Only anonymous `GET /v1/rest/{articles,colleges,courses,exams}` requests for active
content are cached. Articles must also be Published and explicitly site-scoped
after authorization. Authenticated requests, cookies, OTPs, admin data, writes,
errors, and responses over 256 KiB bypass the cache. Query filters, pagination,
representation and count/range headers have separate keys; CORS and request IDs
are generated for each response, not shared.

`REDIS_CACHE_TTL_SECONDS` defaults to 60, capped at 300. Successful REST content
writes, Studio/agent publications, approved reviews and data-cleaner changes
invalidate the public generation after the database commit. In-flight reads can
finish with their earlier snapshot, but cannot repopulate the new generation.
External SQL/import scripts are bounded by the TTL; after a bulk import, restart
the API to clear the generation immediately. A Redis failure falls back to MySQL
with 200 ms connection/command timeouts and a 15-second retry pause; reconnecting
clears the generation before serving cached data. MySQL remains authoritative.

Redis is disposable: configure `maxmemory` and `allkeys-lru`, not unlimited memory.
Do not share the cache instance with durable session or OTP storage. No Redis
hosting is provisioned by this code or the existing deployment workflows.

For an isolated local integration test, start an installed Redis on loopback with
no persistence (for example port 16379), then run:

```sh
REDIS_TEST_URL=redis://127.0.0.1:16379 node --test backend/test/public-content-cache*.test.mjs
```

The real-Redis tests use a random namespace; they never flush a database. Normal
`npm --prefix backend test` runs the deterministic cache and authorization tests
without requiring Redis. Configure `REDIS_URL` in the local backend environment
only after the tests pass. Measure hit rate, latency and memory under controlled
staging traffic before sizing a production cache; this is not a load-test result.
