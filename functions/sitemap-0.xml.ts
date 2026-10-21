const liveSitemaps = new Set(["/sitemap-0.xml", "/news-sitemap.xml"]);

export const onRequest = async ({ request }: { request: Request }): Promise<Response> => {
  const pathname = new URL(request.url).pathname;
  if (!liveSitemaps.has(pathname)) return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

  try {
    const upstream = await fetch(`https://aws-origin.dekhocampus.com${pathname}`, { method: request.method });
    if (!upstream.ok || !upstream.headers.get("content-type")?.includes("xml")) throw new Error("Sitemap origin unavailable");
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=30, s-maxage=30, must-revalidate",
      },
    });
  } catch {
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "cache-control": "no-store", "retry-after": "60" } });
  }
};
