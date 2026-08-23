import http from "node:http";
import { handleRequest } from "./index.mjs";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
http.createServer(async (req, res) => {
  const origin = `http://${req.headers.host || `localhost:${port}`}`;
  try {
    if (String(process.env.REQUEST_LOG || "").toLowerCase() === "yes") console.info(`${req.method} ${req.url}`);
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const request = new Request(new URL(req.url, origin), {
      method: req.method,
      headers: req.headers,
      body: hasBody ? req : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
    });
    const response = await handleRequest(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}).listen(port, host, () => console.log(`DekhoCampus Node/Prisma backend listening on http://${host}:${port}`));
