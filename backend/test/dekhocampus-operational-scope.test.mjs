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
  assert.match(cleanup, /select\(\.fromPort == 22 and \.state == "open"\)\] \| length == 0/);
});
