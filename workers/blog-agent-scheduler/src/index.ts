/** Cloudflare Worker Cron Trigger for the Node blog auto-agent. */
type Env = { API_URL?: string; BLOG_AGENT_SECRET?: string };

async function runBlogAgent(env: Env) {
  if (!env.API_URL || !env.BLOG_AGENT_SECRET) {
    throw new Error("API_URL and BLOG_AGENT_SECRET must be configured as Worker secrets");
  }
  const response = await fetch(`${env.API_URL.replace(/\/$/, "")}/v1/functions/admin-blog-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-blog-agent-secret": env.BLOG_AGENT_SECRET },
    body: JSON.stringify({ trigger_type: "schedule" }),
  });
  if (!response.ok) throw new Error(`admin-blog-agent returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
}

export default {
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    ctx.waitUntil(runBlogAgent(env));
  },
};
