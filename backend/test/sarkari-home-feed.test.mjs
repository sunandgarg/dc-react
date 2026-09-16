import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/db.mjs";
import { handleRequest } from "../src/index.mjs";
import {
  SARKARI_HOME_CATEGORIES,
  SARKARI_HOME_FEED_MAX_BYTES,
  SARKARI_HOME_FEED_MAX_ITEMS,
  SARKARI_HOME_FEED_READ_LIMIT,
  SARKARI_HOME_FEED_SQL,
  buildSarkariHomeFeed,
  loadSarkariHomeFeed,
  sarkariHomeFeedInternals,
} from "../src/sarkari-home-feed.mjs";

const encoder = new TextEncoder();
const cardKeys = ["category", "createdAt", "description", "id", "slug", "title"];

function row(index, category, overrides = {}) {
  return {
    id: `article-${index}`,
    slug: `article-${index}`,
    title: `Article ${index}`,
    description: `Description ${index}`,
    category,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    featuredRank: null,
    feedBucket: category,
    ...overrides,
  };
}

async function withRawQuery(mock, callback) {
  const original = prisma.$queryRawUnsafe;
  prisma.$queryRawUnsafe = mock;
  try { return await callback(); } finally { prisma.$queryRawUnsafe = original; }
}

async function withoutConsoleError(callback) {
  const original = console.error;
  console.error = () => {};
  try { return await callback(); } finally { console.error = original; }
}

test.beforeEach(() => sarkariHomeFeedInternals.resetReadLimit());

test("one fixed SQL roundtrip uses nine independently bounded indexed UNION arms", async () => {
  const { PINNED_BUCKET, LATEST_BUCKET } = sarkariHomeFeedInternals;
  const overlap = row(1, "Results");
  const rows = [
    { ...overlap, feedBucket: PINNED_BUCKET, featuredRank: 2 },
    row(2, "Latest Jobs", { feedBucket: PINNED_BUCKET, featuredRank: 1 }),
    { ...overlap, feedBucket: LATEST_BUCKET },
    ...Array.from({ length: 8 }, (_, index) => row(20 + index, "Latest Jobs", { feedBucket: LATEST_BUCKET })),
    ...SARKARI_HOME_CATEGORIES.flatMap((category, categoryIndex) =>
      Array.from({ length: SARKARI_HOME_FEED_MAX_ITEMS }, (_, itemIndex) => {
        if (category === "Results" && itemIndex === 0) return { ...overlap, feedBucket: "Results" };
        return row(100 + categoryIndex * 20 + itemIndex, category);
      })),
  ];
  const calls = [];
  const payload = await loadSarkariHomeFeed({
    $queryRawUnsafe: async (...args) => {
      calls.push(args);
      return rows;
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [SARKARI_HOME_FEED_SQL]);
  assert.equal((SARKARI_HOME_FEED_SQL.match(/\(SELECT/g) || []).length, 9);
  assert.equal((SARKARI_HOME_FEED_SQL.match(/\nUNION ALL\n/g) || []).length, 8);
  assert.equal((SARKARI_HOME_FEED_SQL.match(/\n  LIMIT 9\)/g) || []).length, 9);
  assert.equal((SARKARI_HOME_FEED_SQL.match(/`site_scope` = 'sarkari'/g) || []).length, 9);
  assert.equal((SARKARI_HOME_FEED_SQL.match(/`status` = 'Published'/g) || []).length, 9);
  assert.equal((SARKARI_HOME_FEED_SQL.match(/`is_active` = 1/g) || []).length, 9);
  assert.equal((SARKARI_HOME_FEED_SQL.match(/FORCE INDEX \(`ix_articles_site_category_public`\)/g) || []).length, 7);
  assert.match(SARKARI_HOME_FEED_SQL, /FORCE INDEX \(`ix_articles_site_featured_public`\)/);
  assert.match(SARKARI_HOME_FEED_SQL, /FORCE INDEX \(`ix_articles_site_public`\)/);
  assert.match(SARKARI_HOME_FEED_SQL, /LEFT\(`slug`, 181\) AS `slug`/);
  assert.match(SARKARI_HOME_FEED_SQL, /LEFT\(`vertical`, 256\) AS `vertical`/);
  assert.equal((SARKARI_HOME_FEED_SQL.match(/JSON_EXTRACT\(`job_posting`, '\$\.validThrough'\)/g) || []).length, 9,
    "pinned, latest and Latest Jobs arms must each filter expired JobPosting data");
  assert.equal((SARKARI_HOME_FEED_SQL.match(/DATE\(CONVERT_TZ\(UTC_TIMESTAMP\(\), '\+00:00', '\+05:30'\)\)/g) || []).length, 3,
    "deadline comparisons must use the India-local calendar date");
  assert.equal((SARKARI_HOME_FEED_SQL.match(/STR_TO_DATE\(/g) || []).length, 3);
  assert.doesNotMatch(SARKARI_HOME_FEED_SQL, /\b(?:WITH|ROW_NUMBER|LIKE|LOWER|CASE)\b/i);
  for (const category of SARKARI_HOME_CATEGORIES) {
    assert.match(SARKARI_HOME_FEED_SQL, new RegExp(`\\\`category\\\` = '${category}'`));
  }

  assert.equal(payload.version, 1);
  assert.deepEqual(Object.keys(payload.byCategory), SARKARI_HOME_CATEGORIES);
  assert.deepEqual(payload.latest.slice(0, 2).map((card) => card.id), ["article-2", overlap.id]);
  assert.equal(new Set(payload.latest.map((card) => card.id)).size, payload.latest.length);
  assert.equal(new Set(payload.latest.map((card) => card.slug)).size, payload.latest.length);
  assert.equal(payload.byCategory.Results.filter((card) => card.id === overlap.id).length, 1,
    "an article in pinned/latest must remain present in its exact category rail");
  for (const category of SARKARI_HOME_CATEGORIES) {
    assert.equal(payload.byCategory[category].length, SARKARI_HOME_FEED_MAX_ITEMS);
    assert.ok(payload.byCategory[category].every((card) => card.category === category));
  }
  for (const card of [...payload.latest, ...Object.values(payload.byCategory).flat()]) {
    assert.deepEqual(Object.keys(card).sort(), cardKeys);
  }
});

test("normalization is bounded while category rails retain exact equality semantics", () => {
  const { LATEST_BUCKET } = sarkariHomeFeedInternals;
  const aliasRows = [
    "Recruitment Notification",
    "Exam Result",
    "Hall Ticket",
    "Provisional Answer Sheet",
    "UG Counselling",
    "Exam Pattern",
    "Merit Scholarship",
  ].map((category, index) => row(index, category, {
    feedBucket: LATEST_BUCKET,
    title: index === 0 ? "  <b>Recruitment</b>\u0000 update  " : `Article ${index}`,
    description: index === 0 ? "&lt;p&gt;Clear &amp; useful&lt;/p&gt;<script>remove me</script>" : `Description ${index}`,
  }));
  const exactResult = row(50, "Results");
  const rows = [
    ...aliasRows,
    row(40, "", { feedBucket: LATEST_BUCKET, vertical: "Exam Result" }),
    exactResult,
    row(52, "results", { feedBucket: "Results" }),
    row(53, "Results ", { feedBucket: "Results" }),
    row(54, "Results", { id: exactResult.id, slug: "duplicate-id", createdAt: "2025-01-01T00:00:00.000Z" }),
    row(55, "Results", { slug: exactResult.slug, createdAt: "2025-01-01T00:00:00.000Z" }),
    row(56, "Results", { slug: "a".repeat(181) }),
    row(561, "Results", { slug: `${"a".repeat(180)} ` }),
    row(57, "Results", { slug: "unsafe / slug" }),
    row(571, "Results", { slug: " leading-space" }),
    row(572, "Results", { slug: "trailing-space " }),
    row(573, "Results", { slug: "Uppercase-Slug" }),
    row(58, "Results", { createdAt: "not-a-date" }),
    row(59, "Results", { title: "<script>empty</script>" }),
    row(60, "Latest Jobs", {
      title: `Large ${"🎓\\\"".repeat(2_000)}`,
      description: "🧑🏽‍💻\\\"".repeat(3_000),
    }),
  ];

  const payload = buildSarkariHomeFeed(rows);
  assert.deepEqual(payload.byCategory.Results.map((card) => card.id), ["article-53", "article-52", exactResult.id]);
  assert.ok(payload.byCategory.Results.every((card) => card.category === "Results"));
  const normalizedById = Object.fromEntries(payload.latest.map((card) => [card.id, card]));
  assert.deepEqual(normalizedById["article-0"], {
    id: "article-0",
    slug: "article-0",
    title: "Recruitment update",
    description: "Clear & useful",
    category: "Latest Jobs",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(aliasRows.map((alias) => normalizedById[alias.id]?.category), [
    "Latest Jobs", "Results", "Admit Card", "Answer Key", "Admissions", "Syllabus", "Scholarships",
  ]);
  assert.equal(normalizedById["article-40"].category, "Results");
  assert.deepEqual(Object.keys(normalizedById["article-40"]).sort(), cardKeys);
  const large = payload.byCategory["Latest Jobs"].find((card) => card.id === "article-60");
  assert.ok(large);
  assert.ok(encoder.encode(large.title).byteLength <= 240);
  assert.ok(encoder.encode(large.description).byteLength <= 800);
  assert.ok(encoder.encode(JSON.stringify(payload)).byteLength <= SARKARI_HOME_FEED_MAX_BYTES);
});

test("pathological query results remain bounded to nine cards per list and 256 KiB", () => {
  const { LATEST_BUCKET } = sarkariHomeFeedInternals;
  const rows = [
    ...Array.from({ length: 12 }, (_, index) => row(index, "Latest Jobs", {
      feedBucket: LATEST_BUCKET,
      title: `Title ${"🎓\\\"".repeat(1_000)}`,
      description: "🧑🏽‍💻\\\"".repeat(2_000),
    })),
    ...SARKARI_HOME_CATEGORIES.flatMap((category, categoryIndex) =>
      Array.from({ length: 12 }, (_, itemIndex) => row(100 + categoryIndex * 100 + itemIndex, category, {
        title: `Title ${"🎓\\\"".repeat(1_000)}`,
        description: "🧑🏽‍💻\\\"".repeat(2_000),
      }))),
  ];
  const payload = buildSarkariHomeFeed(rows);

  assert.equal(payload.latest.length, SARKARI_HOME_FEED_MAX_ITEMS);
  assert.ok(Object.values(payload.byCategory).every((bucket) => bucket.length <= SARKARI_HOME_FEED_MAX_ITEMS));
  assert.ok(encoder.encode(JSON.stringify(payload)).byteLength <= SARKARI_HOME_FEED_MAX_BYTES);
});

test("public GET ignores credentials and returns the fixed cacheable contract", async () => {
  let sql = "";
  await withRawQuery(async (statement) => {
    sql = statement;
    return [row(1, "Results")];
  }, async () => {
    const response = await handleRequest(new Request(
      "https://aws-origin.dekhocampus.com/v1/functions/sarkari-home-feed",
      {
        headers: {
          authorization: "Bearer invalid-token-must-be-ignored",
          cookie: "dc_session=invalid-cookie-must-be-ignored",
          origin: "https://sarkari.dekhocampus.com",
          "x-dc-client-ip": "192.0.2.10",
          "x-request-id": "sarkari-feed-get",
        },
      },
    ));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    assert.equal(sql, SARKARI_HOME_FEED_SQL);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ["version", "latest", "byCategory"]);
    assert.equal(body.version, 1);
    assert.deepEqual(Object.keys(body.byCategory), SARKARI_HOME_CATEGORIES);
  });
});

test("query strings are rejected before SQL and URL variants share the fixed IP limiter", async () => {
  let queries = 0;
  await withRawQuery(async () => { queries += 1; return []; }, async () => {
    for (let index = 0; index < SARKARI_HOME_FEED_READ_LIMIT; index += 1) {
      const response = await handleRequest(new Request(
        `https://aws-origin.dekhocampus.com/v1/functions/sarkari-home-feed?nonce=${index}`,
        { headers: { "x-dc-client-ip": "192.0.2.20" } },
      ));
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json()).code, "SARKARI_HOME_FEED_QUERY_NOT_ALLOWED");
    }
    await withoutConsoleError(async () => {
      const limited = await handleRequest(new Request(
        "https://aws-origin.dekhocampus.com/v1/functions/sarkari-home-feed",
        { headers: { "x-dc-client-ip": "192.0.2.20" } },
      ));
      assert.equal(limited.status, 429);
      assert.equal(limited.headers.get("cache-control"), "no-store");
      assert.equal(limited.headers.get("retry-after"), "60");
      assert.equal((await limited.json()).code, "SARKARI_HOME_FEED_RATE_LIMIT");
    });
    assert.equal(queries, 0);

    const independent = await handleRequest(new Request(
      "https://aws-origin.dekhocampus.com/v1/functions/sarkari-home-feed",
      { headers: { "x-dc-client-ip": "192.0.2.21" } },
    ));
    assert.equal(independent.status, 200);
    assert.equal(queries, 1);
  });
});

test("arbitrary client-key text cannot manufacture independent limiter buckets", () => {
  const { normalizeClientKey } = sarkariHomeFeedInternals;
  assert.equal(normalizeClientKey("attacker-controlled-a"), "unknown");
  assert.equal(normalizeClientKey("attacker-controlled-b"), "unknown");
  assert.equal(normalizeClientKey("192.0.2.30"), "192.0.2.30");
});

test("GET and HEAD failures never leak database details and are never cacheable", async () => {
  await withoutConsoleError(async () => {
    await withRawQuery(async () => {
      throw Object.assign(new Error("private SQL syntax and connection detail"), { code: "P2000" });
    }, async () => {
      for (const method of ["GET", "HEAD"]) {
        const response = await handleRequest(new Request(
          "https://aws-origin.dekhocampus.com/v1/functions/sarkari-home-feed",
          { method, headers: { "x-dc-client-ip": method === "GET" ? "192.0.2.40" : "192.0.2.41", "x-request-id": `feed-${method}` } },
        ));
        assert.equal(response.status, 500);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        if (method === "HEAD") {
          assert.equal(await response.text(), "");
        } else {
          const body = await response.json();
          assert.deepEqual(body, {
            code: "SARKARI_HOME_FEED_FAILED",
            message: "The Sarkari homepage feed is temporarily unavailable.",
            requestId: "feed-GET",
          });
          assert.doesNotMatch(JSON.stringify(body), /private|syntax|connection|P2000/i);
        }
      }
    });
  });
});

test("HEAD is bodyless on success and transient database failures remain retryable", async () => {
  await withRawQuery(async () => [row(1, "Results")], async () => {
    const response = await handleRequest(new Request(
      "https://aws-origin.dekhocampus.com/v1/functions/sarkari-home-feed",
      { method: "HEAD", headers: { "x-dc-client-ip": "192.0.2.50" } },
    ));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    assert.equal(await response.text(), "");
  });

  await withoutConsoleError(async () => {
    await withRawQuery(async () => {
      throw Object.assign(new Error("private pool detail"), { code: "P2024" });
    }, async () => {
      const response = await handleRequest(new Request(
        "https://aws-origin.dekhocampus.com/v1/functions/sarkari-home-feed",
        { method: "HEAD", headers: { "x-dc-client-ip": "192.0.2.51", "x-request-id": "sarkari-feed-head-outage" } },
      ));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("retry-after"), "2");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(await response.text(), "");
    });
  });
});

test("unsupported methods and malformed database results fail closed", async () => {
  let queries = 0;
  await withRawQuery(async () => { queries += 1; return []; }, async () => {
    const response = await handleRequest(new Request(
      "https://aws-origin.dekhocampus.com/v1/functions/sarkari-home-feed",
      { method: "POST", headers: { authorization: "Bearer ignored", cookie: "ignored=yes" } },
    ));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(queries, 0);
  });

  assert.deepEqual(buildSarkariHomeFeed([]), {
    version: 1,
    latest: [],
    byCategory: Object.fromEntries(SARKARI_HOME_CATEGORIES.map((category) => [category, []])),
  });
  assert.throws(
    () => buildSarkariHomeFeed({ rows: [] }),
    (error) => error.status === 500 && error.code === "SARKARI_HOME_FEED_INVALID_RESULT",
  );
});

test("generic public article HEAD responses remain bodyless", async () => {
  let queries = 0;
  await withRawQuery(async (sql) => {
    queries += 1;
    assert.match(sql, /^SELECT COUNT\(\*\) AS total FROM `articles`/);
    return [{ total: 1n }];
  }, async () => {
    const response = await handleRequest(new Request("https://aws-origin.dekhocampus.com/v1/rest/articles?limit=1", {
      method: "HEAD",
      headers: {
        origin: "https://sarkari.dekhocampus.com",
        prefer: "count=exact",
      },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(response.headers.get("content-range"), "0-0/1");
    assert.equal(await response.text(), "");
    assert.equal(queries, 1);
  });
});
