import { connect } from "node:net";

export function databaseEndpointReachable(databaseUrl, timeoutMs = 5_000) {
  const url = new URL(databaseUrl);
  const port = Number(url.port || 3306);
  return new Promise((resolve) => {
    const socket = connect({ host: url.hostname, port });
    const finish = (reachable) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

export function createDatabasePoolWatchdog({
  query,
  reachable,
  restart,
  intervalMs = 30_000,
  failureThreshold = 3,
}) {
  let failures = 0;
  let stopped = false;
  let timer;

  async function check() {
    if (stopped) return;
    try {
      await query();
      failures = 0;
    } catch (error) {
      if (error?.code !== "P2024") {
        failures = 0;
        return;
      }
      failures += 1;
      if (failures < failureThreshold) return;
      try {
        if (!(await reachable())) return;
      } catch {
        return;
      }
      stopped = true;
      console.error("Database pool timed out repeatedly while MySQL is reachable; restarting API to replace the stale pool");
      restart();
    }
  }

  function schedule() {
    if (stopped) return;
    timer = setTimeout(async () => {
      try {
        await check();
      } finally {
        schedule();
      }
    }, intervalMs);
    timer.unref();
  }

  return {
    check,
    start: schedule,
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
