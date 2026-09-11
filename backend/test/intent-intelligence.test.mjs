import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildIntentHeuristic,
  handleIntentExport,
  intentCategory,
  linkIntentActivityToLead,
  normalizeIntentSiteScope,
  prepareIntentEvents,
  stampTrackingSiteScope,
  intentIntelligenceInternals,
} from "../src/intent-intelligence.mjs";

test("intent scoring thresholds and heuristic match the legacy product behavior", () => {
  assert.equal(intentCategory(30), "cold");
  assert.equal(intentCategory(31), "warm");
  assert.equal(intentCategory(71), "hot");
  assert.equal(intentCategory(121), "admission_ready");
  const result = buildIntentHeuristic(90, [
    { event_type: "fee_viewed", college_slug: "alpha", course_slug: "btech", city: "Delhi" },
    { event_type: "scholarship_viewed", college_slug: "alpha", course_slug: "mba", city: "Delhi" },
    { event_type: "college_viewed", college_slug: "beta", course_slug: "btech", city: "Noida" },
  ]);
  assert.equal(result.admission_probability, 60);
  assert.equal(result.fee_sensitivity, 33);
  assert.equal(result.scholarship_sensitivity, 33);
  assert.deepEqual(result.top_colleges[0], { value: "alpha", confidence: 67 });
  assert.deepEqual(result.top_courses[0], { value: "btech", confidence: 67 });
});

test("tracking writes receive server-controlled tenant scope and event weights", async () => {
  const database = {
    $queryRawUnsafe: async (sql, ...params) => {
      assert.match(sql, /intent_event_weights/);
      assert.deepEqual(params, ["apply_now"]);
      return [{ event_type: "apply_now", weight: 35 }];
    },
  };
  const [event] = await prepareIntentEvents([{ event_type: "apply_now", metadata: { site_scope: "spoofed", source: "cta" } }], "sarkari", database);
  assert.equal(event.score_delta, 35);
  assert.deepEqual(event.metadata, { site_scope: "sarkari", source: "cta" });
  assert.deepEqual(stampTrackingSiteScope([{ metadata: null }], "dekhocampus")[0].metadata, { site_scope: "dekhocampus" });
  assert.throws(() => normalizeIntentSiteScope("attacker"), (error) => error.code === "INVALID_SITE_SCOPE");
});

test("lead-session linking rejects activity observed in another tenant", async () => {
  const writes = [];
  const database = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes("FROM `leads` WHERE")) return [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Lead" }];
      if (sql.includes("FROM `user_sessions` us")) return [{ lead_id: null, site_scope: null }];
      if (sql.includes("SELECT DISTINCT observed")) return [{ site_scope: "sarkari" }];
      throw new Error(`Unexpected query: ${sql}`);
    },
    $executeRawUnsafe: async (...args) => { writes.push(args); },
  };
  await assert.rejects(
    () => linkIntentActivityToLead({
      leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      visitorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sessionId: "leaked-session",
      siteScope: "dekhocampus",
    }, database),
    (error) => error.status === 409 && error.code === "SESSION_SCOPE_CONFLICT",
  );
  assert.equal(writes.length, 0);
});

test("CRM export enforces both lead and behavioral-score workspace boundaries", async () => {
  const queries = [];
  const writes = [];
  const database = {
    $queryRawUnsafe: async (sql, ...params) => {
      queries.push({ sql, params });
      return [];
    },
    $executeRawUnsafe: async (sql, ...params) => { writes.push({ sql, params }); },
  };
  const response = await handleIntentExport(new Request("https://api.example/v1/functions/intent-export-csv", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ site_scope: "sarkari", format: "csv" }),
  }), "admin-user", database);
  assert.equal(response.status, 200);
  assert.match(queries[0].sql, /INNER JOIN `leads` l[\s\S]*l\.`site_scope` = \?/);
  assert.match(queries[0].sql, /JSON_EXTRACT\(s\.`signals`, '\$\.site_scope'\)/);
  assert.deepEqual(queries[0].params.slice(0, 2), ["sarkari", "sarkari"]);
  assert.equal(writes.length, 1);
  assert.match(String(writes[0].params[2]), /"site_scope":"sarkari"/);
  assert.match(response.headers.get("content-disposition"), /sarkari-dekhocampus-leads/);
});

test("CSV export neutralizes spreadsheet formulas after whitespace and controls", () => {
  const { csvEscape } = intentIntelligenceInternals;
  assert.equal(csvEscape("=HYPERLINK(\"https://evil.example\")"), `"'=HYPERLINK(""https://evil.example"")"`);
  assert.equal(csvEscape("  +cmd|' /C calc'!A0"), "'  +cmd|' /C calc'!A0");
  assert.equal(csvEscape("\t-2+3"), "'\t-2+3");
  assert.equal(csvEscape("\u0000@SUM(A1:A2)"), "'\u0000@SUM(A1:A2)");
  assert.equal(csvEscape("student@example.com"), "student@example.com");
});

test("native intent functions are routed and fresh databases auto-increment event IDs", async () => {
  const [indexSource, restSource, schema, parity] = await Promise.all([
    readFile(new URL("../src/index.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/rest.mjs", import.meta.url), "utf8"),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../scripts/apply-mysql-parity.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(indexSource, /\["predict-lead-intent", "intent-export-csv", "summarize-user-session"\]/);
  assert.match(indexSource, /resolveIdentity\(request\)[\s\S]*isAdmin\(identity\.id\)/);
  assert.match(restSource, /updateIntentScoresForEvents\(inserted, context\.siteScope\)/);
  assert.match(restSource, /mergeIntentVisitor\(body\._visitor_id, body\._user_id, body\._site_scope\)/);
  assert.match(schema, /model intent_events \{\s+id\s+BigInt\s+@id @default\(autoincrement\(\)\)/);
  const writeLock = parity.indexOf("LOCK TABLES `intent_events` WRITE");
  const zeroIdRepair = parity.indexOf("UPDATE `intent_events` SET `id` = ? WHERE `id` = 0");
  const autoIncrementAlter = parity.indexOf("ALTER TABLE `intent_events` MODIFY `id` BIGINT NOT NULL AUTO_INCREMENT");
  assert.ok(writeLock >= 0, "intent migration must block concurrent event inserts");
  assert.ok(zeroIdRepair >= 0, "legacy zero IDs must be resequenced before enabling AUTO_INCREMENT");
  assert.ok(writeLock < zeroIdRepair && zeroIdRepair < autoIncrementAlter, "the lock, repair, and AUTO_INCREMENT alteration must stay ordered");
  assert.match(parity, /Number\(repair\.affectedRows\) !== zeroIds/);
  assert.match(parity, /SELECT COUNT\(\*\) AS zeroIds FROM `intent_events` WHERE `id` = 0/);
  assert.match(parity, /finally \{\s+await mysqlConnection\.query\("UNLOCK TABLES"\)/);
});
