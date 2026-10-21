import { prisma } from "./db.mjs";

export async function aiUsageSummary(client = prisma, now = new Date()) {
  // Billing months are UTC; aggregate in MySQL so the REST 1,000-row cap
  // cannot silently underreport a busy month.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [events, budgets] = await Promise.all([
    client.$queryRawUnsafe(`
      SELECT provider, model, feature, COUNT(*) AS requests,
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COALESCE(SUM(image_count), 0) AS image_count,
        COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
      FROM ai_usage_events
      WHERE created_at >= ? AND created_at < ?
      GROUP BY provider, model, feature
    `, monthStart, nextMonth),
    client.ai_budget_settings.findMany({ select: { provider: true, monthly_budget_usd: true, baseline_spend_usd: true } }),
  ]);
  return {
    month_start: monthStart.toISOString(),
    events: events.map((row) => ({
      provider: row.provider, model: row.model, feature: row.feature,
      requests: Number(row.requests || 0),
      input_tokens: Number(row.input_tokens || 0), output_tokens: Number(row.output_tokens || 0),
      image_count: Number(row.image_count || 0), estimated_cost_usd: Number(row.estimated_cost_usd || 0),
    })),
    budgets: budgets.map((row) => ({ provider: row.provider, monthly_budget_usd: Number(row.monthly_budget_usd || 0), baseline_spend_usd: Number(row.baseline_spend_usd || 0) })),
  };
}
