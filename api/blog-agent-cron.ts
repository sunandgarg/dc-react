import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_URL = (process.env.API_URL || process.env.VITE_API_URL || "http://localhost:8787").replace(/\/$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const blogAgentSecret = process.env.BLOG_AGENT_SECRET;
  if (!blogAgentSecret) {
    return res.status(500).json({ error: "BLOG_AGENT_SECRET is not configured in Vercel" });
  }

  const response = await fetch(`${API_URL}/v1/functions/admin-blog-agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-blog-agent-secret": blogAgentSecret,
    },
    body: JSON.stringify({ trigger_type: "schedule" }),
  });

  const data = await response.json().catch(() => ({}));
  return res.status(response.ok ? 200 : response.status).json(data);
}
