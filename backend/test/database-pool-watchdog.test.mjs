import assert from "node:assert/strict";
import test from "node:test";
import { createDatabasePoolWatchdog } from "../src/database-pool-watchdog.mjs";

const poolTimeout = () => Object.assign(new Error("pool timeout"), { code: "P2024" });

test("restarts only after repeated pool timeouts while MySQL is reachable", async () => {
  let restarts = 0;
  const watchdog = createDatabasePoolWatchdog({
    query: async () => { throw poolTimeout(); },
    reachable: async () => true,
    restart: () => { restarts += 1; },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    await watchdog.check();
    await watchdog.check();
    assert.equal(restarts, 0);
    await watchdog.check();
    await watchdog.check();
    assert.equal(restarts, 1);
  } finally {
    console.error = originalError;
  }
});

test("successful queries reset the timeout count", async () => {
  let attempts = 0;
  let restarts = 0;
  const watchdog = createDatabasePoolWatchdog({
    query: async () => { if (++attempts !== 2) throw poolTimeout(); },
    reachable: async () => true,
    restart: () => { restarts += 1; },
  });
  await watchdog.check();
  await watchdog.check();
  await watchdog.check();
  await watchdog.check();
  assert.equal(restarts, 0);
});

test("does not restart while MySQL is unreachable", async () => {
  let restarts = 0;
  const watchdog = createDatabasePoolWatchdog({
    query: async () => { throw poolTimeout(); },
    reachable: async () => false,
    restart: () => { restarts += 1; },
  });
  await watchdog.check();
  await watchdog.check();
  await watchdog.check();
  assert.equal(restarts, 0);
});

test("other errors do not count as stale-pool timeouts", async () => {
  let attempts = 0;
  let restarts = 0;
  const watchdog = createDatabasePoolWatchdog({
    query: async () => { throw ++attempts === 2 ? new Error("other") : poolTimeout(); },
    reachable: async () => true,
    restart: () => { restarts += 1; },
  });
  await watchdog.check();
  await watchdog.check();
  await watchdog.check();
  await watchdog.check();
  assert.equal(restarts, 0);
});
