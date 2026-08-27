# DekhoCampus

DekhoCampus is a React/Vite application backed by the native Node, Prisma, and MySQL service in `backend/`.

## Production

- Cloudflare Pages serves the React frontend at `https://dekhocampus.com`.
- A Cloudflare Pages Worker proxies API, authentication, sitemap, and media requests to AWS.
- AWS Lightsail runs the Node API and managed MySQL database in `ap-south-1`.
- AWS S3 stores uploaded and published media. Public media is exposed through the site origin.
- AWS Secrets Manager stores server-only runtime credentials.

The production runtime has no external database, authentication, function, or object-storage fallback.

## Local development

Use Node.js 22 and MySQL 8 or newer.

```sh
npm ci
npm --prefix backend ci
cp backend/.env.example backend/.env.local
npm --prefix backend run prisma:generate
npm --prefix backend run db:push
npm --prefix backend run db:parity
npm run dev:backend
npm run dev
```

The frontend defaults to the current browser origin. Set `VITE_API_URL=http://127.0.0.1:8787` when the frontend and API run on different local origins.

## Verification

```sh
npm test
npm --prefix backend test
npm run lint
npm run build
```

## Deployment

- `.github/workflows/deploy-aws-lightsail.yml` deploys and verifies the AWS API, MySQL, S3, and sitemap runtime.
- `.github/workflows/deploy-cloudflare-pages.yml` builds and publishes the frontend.
- `infra/aws/lightsail-production.yaml` is the production infrastructure definition.

Required GitHub production secrets include the AWS deployment role, native authentication secret, Fast2SMS key, Gemini key, and OpenAI key. Never expose server credentials through a `VITE_*` variable.
