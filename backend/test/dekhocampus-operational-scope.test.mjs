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
  assert.match(workflow, /DEPLOY_SHA="\$6"/);
  assert.match(workflow, /\[\[ "\$DEPLOY_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
  assert.match(workflow, /git fetch --no-tags origin "\$DEPLOY_SHA"/);
  assert.match(workflow, /git reset --hard "\$DEPLOY_SHA"/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$DEPLOY_SHA"/);
  assert.doesNotMatch(workflow, /git reset --hard origin\/main/);
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

test("AWS runtime allows a low-memory API enough time to become healthy", async () => {
  const workflow = await readSource("../../.github/workflows/deploy-aws-lightsail.yml");
  const runtimeStart = workflow.indexOf("- name: Configure AWS runtime");
  const sitemapStart = workflow.indexOf("- name: Generate static sitemap seed and site metadata");
  const runtimeStep = workflow.slice(runtimeStart, sitemapStart);

  assert.match(runtimeStep, /for attempt in \$\(seq 1 90\)/);
  assert.match(runtimeStep, /pm2 logs dc-react-api --lines 120 --nostream/);
});
