import assert from "node:assert/strict";
import test from "node:test";
import { configureDatabaseUrl } from "../src/database-url.mjs";

test("assembles and encodes an ECS database URL with strict TLS", () => {
  const keys = ["DATABASE_URL", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_SSL_CA"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    delete process.env.DATABASE_URL;
    Object.assign(process.env, {
      DB_HOST: "database.internal",
      DB_PORT: "3306",
      DB_NAME: "dc_react",
      DB_USER: "dc admin",
      DB_PASSWORD: "p@ss:/word",
      DB_SSL_CA: "global-bundle.pem",
    });
    assert.equal(
      configureDatabaseUrl(),
      "mysql://dc%20admin:p%40ss%3A%2Fword@database.internal:3306/dc_react?sslcert=global-bundle.pem&sslaccept=strict",
    );
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
