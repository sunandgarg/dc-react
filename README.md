# DekhoCampus React, Node, Prisma, and MySQL

The existing React/Vite frontend is preserved. Application data can now be routed to the Node/Prisma/MySQL backend in `backend/` by setting `VITE_USE_MYSQL=yes`, `VITE_USE_SUPABASE=no`, and `VITE_API_URL`.

For local setup and API details, see `backend/README.md`. For verified scope, unresolved production dependencies, and the exact cutover order, see `docs/MIGRATION_STATUS.md`.

# Original project documentation

## Production hosting

DigitalOcean App Platform serves the React frontend and Node API. A managed
MySQL cluster stores application and auth data. The existing Supabase project
is retained only for files and images; uploads are authorized by Node and the
Supabase storage service key is never exposed to the browser.

The production app specification is in `.do/app.yaml`. Deployment details,
required encrypted variables, and the first-admin procedure are documented in
`docs/DIGITALOCEAN_DEPLOYMENT.md`.

## Legacy content migration

`npm run import:static` imports the public pre-rendered college, course, exam,
and article data from the archived site. It deliberately excludes leads, user
accounts, passwords, and any other personal data. Existing Supabase slugs are
never overwritten: every collision is written to the JSON report.

Run a read-only audit first:

```sh
npm run import:static -- --content-root "/path/to/.next/server/pages" \
  --report reports/legacy-static-import-report.json
```

To import, use the **Supabase service-role key only in your local terminal**.
Do not put this key in Vercel, a browser `.env`, or GitHub. Imports are drafts
by default, so old admission and exam information must be reviewed before it
becomes public. Add `--publish` only after review. `--mirror-assets` downloads
only HTTPS files from the known legacy AWS/CloudFront hosts into Supabase
Storage; failed files retain their original public URL and are listed in the
report.

```sh
SUPABASE_URL="https://kozdctbbvrnyddlftmvf.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" \
npm run import:static -- --content-root "/path/to/.next/server/pages" \
  --apply --mirror-assets --report reports/legacy-static-import-report.json
```

### 31-12-2024 CSV database

Use `import:legacy-csv` for the relational CSV export containing `colleges.csv`,
`course_info.csv`, `exams.csv`, `college_course.csv`, and the supporting public
content tables. The importer ignores users, accounts, leads, and other private
tables. It normalizes legacy fields such as `Estd 2010`, resolves duplicate
slugs, enriches existing rows without replacing curated content, and creates
deterministic course-fee IDs so reruns are safe.

Run the audit and produce Supabase-compatible manual fallback files:

```sh
npm run import:legacy-csv -- \
  --source-dir "/absolute/path/CSV Excel Database" \
  --export-dir reports/legacy-csv-mapped \
  --report reports/legacy-csv-import-report.json
```

For a direct import, explicitly provide the production project ref and its
matching secret/service-role key. The script refuses a mismatched URL and never
loads the frontend `.env` for privileged writes. New rows remain Draft unless
`--publish` is added.

```sh
export SUPABASE_URL="https://kozdctbbvrnyddlftmvf.supabase.co"
read -rs "SUPABASE_SERVICE_ROLE_KEY?Paste Supabase secret/service-role key: "
echo
export SUPABASE_SERVICE_ROLE_KEY

npm run import:legacy-csv -- \
  --source-dir "/absolute/path/CSV Excel Database" \
  --apply --project-ref kozdctbbvrnyddlftmvf \
  --report reports/legacy-csv-import-report.json
```

If Dashboard CSV import is required, import the generated files in this order:
`courses.csv`, `exams.csv`, `colleges.csv`, then `course_fees.csv`.

Use `--skip-existing` for a fast recovery run after a network interruption. It
inserts only missing slugs and leaves every successful row untouched.

### Legacy image migration to WebP

`migrate:legacy-assets` inventories legacy AWS/CloudFront image references in
colleges, courses, exams and articles. With `--apply`, it downloads each unique
image once, normalizes orientation, limits it to 1920×1920, converts it to WebP,
uploads it to the public `legacy-public-assets` Supabase Storage bucket, verifies
the uploaded object, and only then replaces the database reference. Failed
downloads keep their old URL. Content-addressed object names and database-first
inventory make reruns safe and resumable.

Run inventory first:

```sh
npm run migrate:legacy-assets -- \
  --project-ref kozdctbbvrnyddlftmvf \
  --report reports/legacy-asset-inventory.json
```

Apply in controlled batches after reviewing the inventory and Supabase File
Storage allowance:

```sh
npm run migrate:legacy-assets -- \
  --project-ref kozdctbbvrnyddlftmvf \
  --apply --limit 500 --concurrency 6 --quality 82 \
  --report reports/legacy-asset-migration-report.json
```

Rerun the same controlled batch command until inventory reaches zero. Use
`--all` only when deliberately scheduling every remaining object in one run.

The command requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local
terminal. The key must never be committed or exposed to browser code.

### Collegedunia watermark sanitization

`sanitize:collegedunia` removes the bottom 12% from every referenced legacy
public-bucket image. It covers all current string and string-array image fields,
including college galleries, course/exam images, logos, articles, careers,
faculty, promotional content, and study resources.

The sanitizer never overwrites or deletes an original. It writes a verified
WebP under `sanitized/bottom-12-v1/` and updates a database reference only after
the new object exists. New object URLs also prevent stale one-year browser/CDN
caches from continuing to serve the old watermarked image. Reruns are safe and
resume from the remaining unsanitized references.

Inventory first:

```sh
npm run sanitize:collegedunia -- \
  --project-ref kozdctbbvrnyddlftmvf \
  --report reports/collegedunia-watermark-inventory.json
```

Apply in batches:

```sh
npm run sanitize:collegedunia -- \
  --project-ref kozdctbbvrnyddlftmvf \
  --apply --limit 500 --concurrency 8 \
  --report reports/collegedunia-watermark-sanitization.json
```

Repeat until inventory reports `unique_assets: 0`, or use `--all` for a
deliberate full run. The command requires `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`.

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
