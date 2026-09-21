import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("DekhoCampus dashboards scope article and lead reads", async () => {
  const [dashboard, insights, marketing, users, userAnalytics] = await Promise.all([
    readSource("../../src/pages/AdminDashboard.tsx"),
    readSource("../../src/components/AdminInsights.tsx"),
    readSource("../../src/pages/AdminMarketingAutomation.tsx"),
    readSource("../../src/pages/AdminUsers.tsx"),
    readSource("../../src/pages/AdminUserAnalytics.tsx"),
  ]);

  assert.ok((dashboard.match(/\.eq\("site_scope", DEFAULT_SITE_SCOPE\)/g) || []).length >= 5);
  assert.match(insights, /useCount\("articles", DEFAULT_SITE_SCOPE\)/);
  assert.match(insights, /\.from\("leads"\)[\s\S]*?\.eq\("site_scope", DEFAULT_SITE_SCOPE\)/);
  assert.ok((marketing.match(/\.eq\("site_scope", DEFAULT_SITE_SCOPE\)/g) || []).length >= 2);
  assert.match(users, /\.from\("leads"\)[\s\S]*?\.eq\("site_scope", DEFAULT_SITE_SCOPE\)/);
  assert.match(userAnalytics, /\.from\("leads"\)[\s\S]*?\.eq\("site_scope", DEFAULT_SITE_SCOPE\)/);
});

test("lead intelligence admits only lead-linked DekhoCampus scores", async () => {
  const source = await readSource("../../src/pages/AdminLeadIntelligence.tsx");

  assert.match(source, /keepDekhoCampusLeadScores/);
  assert.match(source, /if \(!leadIds\.length\) return \[\]/);
  assert.match(source, /\.from\("leads"\)[\s\S]*?\.eq\("site_scope", DEFAULT_SITE_SCOPE\)/);
  assert.match(source, /site_scope: DEFAULT_SITE_SCOPE/);
});

test("DekhoCampus-only lead utilities reject Sarkari lead rows", async () => {
  const [catExperience, backgroundProcessor, leadValidation] = await Promise.all([
    readSource("../src/cat-experience.mjs"),
    readSource("../../src/lib/datastore/background-processor.ts"),
    readSource("../../src/utils/leadValidation.ts"),
  ]);

  assert.match(catExperience, /where: \{ id: leadId, site_scope: "dekhocampus" \}/);
  assert.match(backgroundProcessor, /\.eq\('site_scope', 'dekhocampus'\)/);
  assert.match(leadValidation, /\.eq\('site_scope', 'dekhocampus'\)/);
});

test("daily lead rollups keep tenants in separate groups", async () => {
  const migration = await readSource("../scripts/apply-mysql-parity.mjs");

  assert.match(migration, /MIN\(id\) AS representative_id,\s+site_scope,/);
  assert.match(migration, /GROUP BY site_scope, lead_day, identity_key/);
});

test("routine parity skips completed tenant-scope backfills", async () => {
  const migration = await readSource("../scripts/apply-mysql-parity.mjs");

  assert.match(migration, /if \(existingConstraint\.length\) \{[\s\S]*?continue;[\s\S]*?UPDATE \$\{quote\(table\)\}/);
  assert.doesNotMatch(migration, /UPDATE `articles` SET `site_scope`/);
  assert.doesNotMatch(migration, /UPDATE `leads` SET `site_scope`/);
});

test("generic DekhoCampus article operations carry an explicit scope", async () => {
  const [rest, adminBulk] = await Promise.all([
    readSource("../src/rest.mjs"),
    readSource("../../src/pages/AdminBulk.tsx"),
  ]);

  assert.match(rest, /table === "articles" \? " WHERE `site_scope` = 'dekhocampus'"/);
  assert.match(adminBulk, /scope=\{t\.table === "articles" \? DEKHOCAMPUS_ARTICLE_SCOPE : undefined\}/);
});

test("production public CRUD regression verifies draft hiding before publishing", async () => {
  const source = await readFile(new URL("../scripts/production-crud-regression.mjs", import.meta.url), "utf8");
  assert.match(source, /if \(table === "articles"\) payload\.site_scope = "dekhocampus";/);
  assert.match(source, /if \(table === "articles"\) \{\s+const hiddenDraftRows = await publicRows/);
  assert.match(source, /body: \{ status: "Published", is_active: true \}/);
});

test("AWS production deploy installs the immutable revision verified by its workflow run", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");

  assert.match(workflow, /'\$\{\{ github\.sha \}\}'/);
  assert.match(workflow, /DEPLOY_SHA="\$5"/);
  assert.match(workflow, /\[\[ "\$DEPLOY_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
  assert.match(workflow, /git fetch --no-tags origin "\$DEPLOY_SHA"/);
  assert.match(workflow, /git reset --hard "\$DEPLOY_SHA"/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$DEPLOY_SHA"/);
  assert.doesNotMatch(workflow, /git reset --hard origin\/main/);
  assert.doesNotMatch(workflow, /rm -f[\s\S]*apply-original-college-media-manifest/);
});

test("AWS database recovery is opt-in and requires proven production unavailability", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");
  const recoveryStart = workflow.indexOf("- name: Recover unavailable managed database");
  const infrastructureStart = workflow.indexOf("- name: Validate and deploy infrastructure");
  assert.ok(recoveryStart >= 0 && infrastructureStart > recoveryStart);
  const recoveryStep = workflow.slice(recoveryStart, infrastructureStart);

  assert.match(workflow, /recover_database:[\s\S]*?default: false/);
  assert.match(recoveryStep, /if: \$\{\{ inputs\.recover_database \}\}/);
  assert.match(recoveryStep, /\.database == "unavailable"/);
  assert.match(recoveryStep, /refusing an automatic reboot/);
  assert.match(recoveryStep, /reboot-relational-database/);
  assert.match(recoveryStep, /if \[ "\$STATE" = "available" \]; then/);
  assert.match(recoveryStep, /fresh application runtime can reconnect/);
  assert.match(workflow, /\.ok == true and \.database == "mysql" and \.storage == "s3"/);
});

test("AWS college-media deployment accepts scoped named cutovers without widening the S3 prefix", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");

  assert.match(
    workflow,
    /original-college-media-sanitized\/\[0-9TZ\.\-\]\+\(-\[a-z0-9-\]\+\)\?\/apply-manifest\\\.jsonl/,
  );
  assert.match(workflow, /The sanitized college-media manifest key is outside the approved private prefix/);
  assert.match(workflow, /college_media_source_manifest_key/);
  assert.match(workflow, /The source sanitized college-media manifest key is outside the approved private prefix/);
  assert.match(workflow, /media:build-current-carousel-cutover/);
  assert.match(workflow, /--alias-manifest "\$WORK_DIR\/sanitized-apply-manifest\.jsonl"/);
  assert.match(workflow, /--content-alias-manifest "\$WORK_DIR\/content-alias-manifest\.jsonl"/);
  assert.match(workflow, /--allow-unmapped --unmapped-output/);
  assert.match(workflow, /migration-reports\/original-college-media/);
  assert.match(workflow, /unmapped-college-carousels\.jsonl/);
  assert.match(workflow, /APPLY_MANIFEST="\$WORK_DIR\/current-carousel-cutover-manifest\.jsonl"/);
});

test("live carousel cutover joins manifests by production ID within low memory", async () => {
  const source = await readSource("../scripts/build-current-college-carousel-cutover-manifest.mjs");

  assert.match(source, /mkdtemp\(join\(tmpdir\(\), "dc-college-carousel-join-"\)\)/);
  assert.match(source, /createHash\("sha256"\)\.update\(id\)\.digest\("hex"\)/);
  assert.match(source, /sanitizedIds\.has\(originalId\)/);
  assert.match(source, /readFile\(stagedRowPath\(joinDirectory, originalId, "sanitized"\), "utf8"\)/);
  assert.match(source, /rm\(joinDirectory, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(source, /Manifest order mismatch/);
  assert.doesNotMatch(source, /Promise\.all\(\[originalRows\.next\(\), sanitizedRows\.next\(\)\]\)/);
});

test("AWS production deploy removes every temporary SSH rule during cleanup", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");
  const cleanup = workflow.slice(workflow.indexOf("- name: Close temporary SSH access"));

  assert.match(cleanup, /aws lightsail put-instance-public-ports/);
  assert.match(cleanup, /\{fromPort:80,toPort:80/);
  assert.match(cleanup, /\{fromPort:443,toPort:443/);
  assert.doesNotMatch(cleanup, /\{fromPort:22,toPort:22/);
  assert.match(cleanup, /ApiLegacyInstanceName/);
  assert.match(cleanup, /Api2GbInstanceName/);
  assert.match(cleanup, /for CLEANUP_INSTANCE_NAME in/);
  assert.match(cleanup, /timeout 10 bash -c "<\/dev\/tcp\/\$CLEANUP_IP\/22"/);
  assert.match(cleanup, /Temporary SSH access is still reachable on \$CLEANUP_INSTANCE_NAME after cleanup/);
});

test("long production AI and sitemap tasks keep their SSH sessions alive", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");
  const aiStart = workflow.indexOf("- name: Verify live AI blog agent and cover pipeline");
  const sitemapStart = workflow.indexOf("- name: Publish complete MySQL sitemap generation");
  const crudStart = workflow.indexOf("- name: Run reversible production admin CRUD regression");
  assert.ok(aiStart >= 0 && sitemapStart > aiStart && crudStart > sitemapStart);
  const aiStep = workflow.slice(aiStart, sitemapStart);
  const sitemapStep = workflow.slice(sitemapStart, crudStart);

  for (const step of [aiStep, sitemapStep]) {
    assert.match(step, /ServerAliveInterval=30/);
    assert.match(step, /ServerAliveCountMax=120/);
  }
});

test("AWS production uses an immutable static seed before the direct MySQL sitemap publish", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");
  const staticStart = workflow.indexOf("- name: Generate static sitemap seed and site metadata");
  const uploadStart = workflow.indexOf("- name: Upload immutable build sitemap seed to private S3");
  const publishStart = workflow.indexOf("- name: Publish complete MySQL sitemap generation");
  assert.ok(staticStart >= 0 && uploadStart > staticStart && publishStart > uploadStart);

  const staticStep = workflow.slice(staticStart, uploadStart);
  assert.match(staticStep, /SITEMAP_API_URL: none/);
  assert.match(staticStep, /SITEMAP_SEED_URL: none/);
  assert.match(staticStep, /run: npm run postbuild/);

  const uploadStep = workflow.slice(uploadStart, publishStart);
  assert.match(uploadStep, /SEED_PREFIX="system-sitemaps\/build-seeds\/\$SEED_SHA"/);
  assert.match(uploadStep, /sitemap-\[0-9\]\*\.xml[^\n]*sitemap-index\.xml[^\n]*sitemap\.xml/);
  assert.doesNotMatch(uploadStep, /s3:\/\/\$BUCKET\/system-sitemaps\/public/);

  const publishStep = workflow.slice(publishStart);
  assert.match(publishStep, /sudo bash -s -- '\$\{\{ github\.sha \}\}'/);
  assert.match(publishStep, /export BUILD_SEED_SHA/);
  assert.match(publishStep, /build_seed_sha: process\.env\.BUILD_SEED_SHA/);
});

test("Cloudflare Pages builds reuse the published sitemap instead of walking MySQL", async () => {
  const [workflow, generator] = await Promise.all([
    readSource("../../.github/workflows/deploy-cloudflare-pages.yml"),
    readSource("../../scripts/generate-sitemap.ts"),
  ]);

  assert.match(workflow, /SITEMAP_API_URL: none/);
  assert.match(workflow, /SITEMAP_SEED_URL: https:\/\/dekhocampus\.com\/sitemap\.xml/);
  assert.match(workflow, /SITEMAP_SEED_FETCH_BASE_URL: https:\/\/aws-origin\.dekhocampus\.com/);
  assert.match(workflow, /SITEMAP_FETCH_TIMEOUT_MS: 60000/);
  assert.match(workflow, /SITEMAP_FETCH_ATTEMPTS: 2/);
  assert.match(generator, /const IS_CLOUDFLARE_PAGES_BUILD = env\.CF_PAGES === "1"/);
  assert.match(generator, /IS_CLOUDFLARE_PAGES_BUILD && !env\.SITEMAP_API_URL/);
  assert.match(generator, /SITEMAP_SEED_FETCH_BASE_URL/);
});

test("AWS runtime allows a low-memory API enough time to become healthy", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");
  const runtimeStart = workflow.indexOf("- name: Configure AWS runtime");
  const sitemapStart = workflow.indexOf("- name: Generate static sitemap seed and site metadata");
  const runtimeStep = workflow.slice(runtimeStart, sitemapStart);

  assert.match(runtimeStep, /for attempt in \$\(seq 1 90\)/);
  assert.match(runtimeStep, /pm2 logs dc-react-api --lines 120 --nostream/);
});

test("AWS runtime enables SES only after the DekhoCampus domain identity is verified", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");
  const runtimeStart = workflow.indexOf("- name: Configure AWS runtime");
  const sitemapStart = workflow.indexOf("- name: Generate static sitemap seed and site metadata");
  const runtimeStep = workflow.slice(runtimeStart, sitemapStart);

  assert.match(workflow, /create_ses_identity:[\s\S]*?default: false/);
  assert.match(runtimeStep, /APP_ACCESS_KEY_ID=\$\(aws configure get aws_access_key_id\)/);
  assert.match(runtimeStep, /aws sesv2 get-email-identity[\s\S]*?--email-identity dekhocampus\.com/);
  assert.match(runtimeStep, /--query 'VerifiedForSendingStatus'/);
  assert.match(runtimeStep, /if \[ "\$SES_VERIFIED" = "True" \]; then/);
  assert.match(runtimeStep, /SES_ENABLED=true[\s\S]*?else[\s\S]*?SES_ENABLED=false/);
  assert.match(runtimeStep, /DekhoCampus SES identity verified for the application user/);
  assert.doesNotMatch(runtimeStep, /sudo bash -s --[^\n]*\$SES_ENABLED/);
  assert.doesNotMatch(runtimeStep, /inputs\.create_ses_identity[^\n]*NODE_HEAP_MB/);
});

test("college WebP retirement removes only unreferenced versions from versioned S3", async () => {
  const [template, retire] = await Promise.all([
    readSource("../../infra/aws/lightsail-production.yaml"),
    readSource("../scripts/retire-superseded-college-webp.mjs"),
  ]);

  assert.match(template, /s3:ListBucketVersions/);
  assert.match(template, /s3:DeleteObjectVersion/);
  assert.match(retire, /collectStoredMediaObjectKeys\(row\[field\], prefix\)/);
  assert.match(retire, /VersionId: item\.version_id/);
  assert.match(retire, /const remaining = await listCandidateVersions\(client, deletableKeys\)/);
  assert.match(retire, /if \(remaining\.length\) throw new Error/);
});
