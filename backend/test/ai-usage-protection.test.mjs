import test from "node:test";
import assert from "node:assert/strict";
import { aiUsageSummary } from "../src/ai-usage-summary.mjs";
import { isOpenAiBillingExhausted, markFailedBlogRun, nextJitteredBlogRunAt } from "../src/blog-ai.mjs";

test("monthly usage aggregation includes more than the REST row cap", async () => {
  let range;
  const client = {
    $queryRawUnsafe: async (_sql, start, end) => {
      range = [start, end];
      return [{ provider: "openai", model: "gpt-5.6-luna", feature: "blog-agent", requests: 4315n, input_tokens: 78526434n, output_tokens: 12000n, image_count: 0n, estimated_cost_usd: "14.61" }];
    },
    ai_budget_settings: { findMany: async () => [{ provider: "openai", baseline_spend_usd: "0", monthly_budget_usd: "120" }] },
  };
  const summary = await aiUsageSummary(client, new Date("2026-10-21T12:00:00Z"));
  assert.deepEqual(range.map((date) => date.toISOString()), ["2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"]);
  assert.equal(summary.events[0].requests, 4315);
  assert.equal(summary.events[0].estimated_cost_usd, 14.61);
  assert.equal(summary.budgets[0].monthly_budget_usd, 120);
});

test("only exhausted-credit 429 errors pause an automatic schedule", () => {
  assert.equal(isOpenAiBillingExhausted({ code: "OPENAI_REQUEST_FAILED", status: 429, message: "OpenAI request failed (429): You have run out of credits" }), true);
  assert.equal(isOpenAiBillingExhausted({ code: "OPENAI_REQUEST_FAILED", status: 429, message: "Rate limit exceeded, retry later" }), false);
  assert.equal(isOpenAiBillingExhausted({ code: "OPENAI_REQUEST_FAILED", status: 500, message: "billing" }), false);
  const failedAt = new Date("2026-10-21T12:00:00Z");
  const nextRun = nextJitteredBlogRunAt(failedAt, 60);
  assert.ok(nextRun > new Date(failedAt.getTime() + 60 * 60_000));
});

test("failed scheduled runs advance before the next one-minute poll", async () => {
  const calls = [];
  const client = {
    blog_auto_agent_settings: { update: async (args) => calls.push(["schedule", args.data]) },
    entity_article_schedules: { update: async (args) => calls.push(["entity", args.data]) },
    blog_auto_agent_runs: { update: async (args) => calls.push(["run", args.data]) },
  };
  const failedAt = new Date("2026-10-21T12:00:00Z");
  await markFailedBlogRun(client, { runId: "run-1", triggerType: "schedule", interval: 60, error: new Error("Invalid article"), failedAt });
  assert.deepEqual(calls.map(([kind]) => kind), ["schedule", "run"]);
  assert.ok(calls[0][1].next_run_at > new Date(failedAt.getTime() + 60 * 60_000));
  assert.equal(calls[0][1].enabled, undefined);
  calls.length = 0;
  await markFailedBlogRun(client, { runId: "run-2", triggerType: "schedule", interval: 60, error: { code: "OPENAI_REQUEST_FAILED", status: 429, message: "No credits remaining" }, failedAt });
  assert.equal(calls[0][1].enabled, false);
  calls.length = 0;
  await markFailedBlogRun(client, { runId: "run-3", triggerType: "manual", interval: 60, error: new Error("Invalid article"), failedAt });
  assert.deepEqual(calls.map(([kind]) => kind), ["run"]);
  calls.length = 0;
  await markFailedBlogRun(client, { runId: "run-4", triggerType: "schedule", entityContext: { schedule: { id: "entity-1", interval_minutes: 1440 } }, error: new Error("Invalid article"), failedAt });
  assert.deepEqual(calls.map(([kind]) => kind), ["entity", "run"]);
  assert.ok(calls[0][1].next_run_at > failedAt);
});
