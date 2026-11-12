import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest } from "../src/index.mjs";
import { prisma } from "../src/db.mjs";

test("homepage reads only the requested section and still serves older clients", async (t) => {
  const original = prisma.$queryRawUnsafe;
  const read = t.mock.fn(async () => []);
  prisma.$queryRawUnsafe = read;
  t.after(() => { prisma.$queryRawUnsafe = original; });
  const get = suffix => handleRequest(new Request("http://localhost/v1/functions/bootstrap" + suffix));
  const hero = await get("?section=hero_settings");
  assert.deepEqual(await hero.json(), { hero_settings: null });
  assert.equal(read.mock.callCount(), 1);
  assert.match(read.mock.calls[0].arguments[0], /FROM `hero_settings`/);
  assert.equal((await get("?section=constructor")).status, 400);
  assert.equal(read.mock.callCount(), 1);
  const legacy = await get("");
  assert.equal(Object.keys(await legacy.json()).length, 8);
  assert.equal(read.mock.callCount(), 9);
});
