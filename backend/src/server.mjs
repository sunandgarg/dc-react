import http from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { handleRequest } from "./index.mjs";
import { startLeadOutboxWorker, stopLeadOutboxWorker } from "./lead-outbox.mjs";
import { prisma } from "./db.mjs";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
await startLeadOutboxWorker();

const server = http.createServer(async (req, res) => {
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
    if (!response.body) res.end();
    else await pipeline(Readable.fromWeb(response.body), res);
  } catch (error) {
    console.error(error);
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}).listen(port, host, () => console.log(`DekhoCampus Node/Prisma backend listening on http://${host}:${port}`));

async function shutdown(signal) {
  console.log(`Received ${signal}; stopping cleanly`);
  stopLeadOutboxWorker();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
