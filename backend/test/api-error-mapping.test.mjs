import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorInternals, handleRequest } from "../src/index.mjs";
import { prisma } from "../src/db.mjs";

test("transient Prisma connection errors become retryable service-unavailable responses", () => {
  for (const code of ["P1001", "P1002", "P2024"]) {
    const error = Object.assign(new Error("internal Prisma details"), { code });
    assert.deepEqual(apiErrorInternals.classifyRequestError(error), {
      status: 503,
      code: "DATABASE_TEMPORARILY_UNAVAILABLE",
      message: "The database is temporarily unavailable. Please retry shortly.",
      retryAfter: 2,
    });
  }
});

test("transient Prisma errors are recognized through wrapped causes", () => {
  const prismaError = Object.assign(new Error("pool timeout"), { code: "P2024" });
  const wrapped = new Error("query failed", { cause: prismaError });
  assert.equal(apiErrorInternals.transientDatabaseErrorCode(wrapped), "P2024");
  assert.equal(apiErrorInternals.classifyRequestError(wrapped).status, 503);
});

test("explicit HTTP errors keep their contract", () => {
  const error = Object.assign(new Error("rate limited"), { status: 429, code: "RATE_LIMITED", retryAfter: 30 });
  assert.deepEqual(apiErrorInternals.classifyRequestError(error), {
    status: 429,
    code: "RATE_LIMITED",
    message: "rate limited",
    retryAfter: 30,
  });
});

test("non-transient Prisma errors are not advertised as retryable outages", () => {
  const error = Object.assign(new Error("unique constraint"), { code: "P2002" });
  assert.deepEqual(apiErrorInternals.classifyRequestError(error), {
    status: 400,
    code: "P2002",
    message: "unique constraint",
    retryAfter: undefined,
  });
});

test("the HTTP boundary returns Retry-After without leaking Prisma details", async () => {
  const originalQuery = prisma.$queryRawUnsafe;
  const originalConsoleError = console.error;
  prisma.$queryRawUnsafe = async () => {
    throw Object.assign(new Error("sensitive pool timeout details"), { code: "P2024" });
  };
  console.error = () => {};
  try {
    const response = await handleRequest(new Request("https://aws-origin.dekhocampus.com/v1/rest/articles?limit=1", {
      headers: {
        origin: "https://sarkari.dekhocampus.com",
        "x-request-id": "transient-database-test",
      },
    }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "2");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      code: "DATABASE_TEMPORARILY_UNAVAILABLE",
      message: "The database is temporarily unavailable. Please retry shortly.",
      requestId: "transient-database-test",
    });
  } finally {
    prisma.$queryRawUnsafe = originalQuery;
    console.error = originalConsoleError;
  }
});
