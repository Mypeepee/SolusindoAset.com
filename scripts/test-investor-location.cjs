/** Official-region validation and correction writes on isolated fixtures only. */
const assert = require("node:assert/strict");
const { Client } = require("pg");
const { Prisma } = require("@prisma/client");
require("dotenv").config({ quiet: true });
const client = new Client({ connectionString: process.env.DATABASE_URL });
const sql = async (query, ...values) => {
  const s = Array.isArray(query) ? Prisma.sql(query, ...values) : query;
  let i = 0;
  return client.query(
    s.sql.replace(/\?/g, () => `$${++i}`),
    s.values,
  );
};
const db = {
  $queryRaw: async (...a) => (await sql(...a)).rows,
  $executeRaw: async (...a) => (await sql(...a)).rowCount,
  $transaction: async (fn) => fn(db),
};
let deny = null,
  invalidations = 0;
const regions = {
  provinsi: [{ id: "35", name: "JAWA TIMUR" }],
  kota: [{ id: "3578", name: "KOTA SURABAYA" }],
  kecamatan: [{ id: "357801", name: "KARANGPILANG" }],
  kelurahan: [{ id: "3578011001", name: "KEBRAON" }],
};
const load = require("./lib/investor-test-loader.cjs")({
  "@/lib/prisma": db,
  "@/lib/indonesia-regions.server": {
    getIndonesiaRegions: async (level) => regions[level],
  },
  "@/lib/investor-cma-legacy.server": {
    invalidateInvestorCache: () => invalidations++,
  },
  "@/lib/investor-owner.server": {
    requireInvestorOwner: async () => deny,
    investorPrivateHeaders: { "Cache-Control": "private, no-store" },
  },
});
const service = load("src/lib/investor-location.server.ts");
const route = load("src/app/api/dashboard/investor/[id]/location/route.ts");
const { NextRequest, NextResponse } = require("next/server");
const request = (body, headers = {}) =>
  new NextRequest("http://localhost/api/dashboard/investor/99123/location", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
      ...headers,
    },
    body: JSON.stringify(body),
  });
(async () => {
  await client.connect();
  try {
    await client.query("BEGIN");
    const schema = `investor_location_test_${process.pid}`;
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema},public`);
    await client.query(
      "CREATE TABLE listing (LIKE public.listing INCLUDING DEFAULTS INCLUDING CONSTRAINTS)",
    );
    const row = require("./fixtures/investor-cma.cjs").event(
      99123,
      "99123",
      250e6,
      100,
      { kelurahan: null },
    );
    const keys = Object.keys(row);
    await client.query(
      `INSERT INTO listing(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      Object.values(row),
    );
    const before = (
      await client.query("SELECT * FROM listing WHERE id_property=99123")
    ).rows[0];
    const options = await service.getInvestorLocationOptions("99123");
    assert.equal(options.cityName, "KOTA SURABAYA");
    assert.equal(options.kelurahan[0].name, "KEBRAON");
    const valid = {
      districtId: "357801",
      kelurahanId: "3578011001",
      revision: options.revision,
    };
    await assert.rejects(
      () =>
        service.correctInvestorLocation("99123", {
          ...valid,
          districtId: "999999",
        }),
      /INVALID_DISTRICT/,
    );
    await assert.rejects(
      () =>
        service.correctInvestorLocation("99123", {
          ...valid,
          kelurahanId: "999999",
        }),
      /INVALID_KELURAHAN/,
    );
    await assert.rejects(
      () =>
        service.correctInvestorLocation("99123", {
          ...valid,
          revision: "0".repeat(32),
        }),
      /LOCATION_CONFLICT/,
    );
    deny = NextResponse.json({ error: "Denied" }, { status: 403 });
    assert.equal(
      (await route.PATCH(request(valid), { params: { id: "99123" } })).status,
      403,
    );
    deny = null;
    assert.equal(
      (
        await route.PATCH(request(valid, { Origin: "https://other.example" }), {
          params: { id: "99123" },
        })
      ).status,
      403,
    );
    const malformed = new NextRequest(
      "http://localhost/api/dashboard/investor/99123/location",
      { method: "PATCH", body: "{" },
    );
    assert.equal(
      (await route.PATCH(malformed, { params: { id: "99123" } })).status,
      400,
    );
    const result = await route.PATCH(
      request({ ...valid, kelurahanName: "INJECTED" }),
      { params: { id: "99123" } },
    );
    assert.equal(result.status, 200);
    const after = (
      await client.query("SELECT * FROM listing WHERE id_property=99123")
    ).rows[0];
    assert.equal(after.kelurahan, "KEBRAON");
    assert.equal(after.kecamatan, "KARANGPILANG");
    for (const key of Object.keys(before).filter(
      (k) => !["kelurahan", "kecamatan", "tanggal_diupdate"].includes(k),
    ))
      assert.deepEqual(after[key], before[key], key);
    assert.equal(invalidations, 1);
    assert.equal(
      (await route.PATCH(request(valid), { params: { id: "99123" } })).status,
      409,
    );
    await client.query("ROLLBACK");
    console.log(
      "Location correction passed: owner guard, origin, official parent validation, malformed input, stale revision, location-only persistence, cache invalidation. Isolated fixture rolled back.",
    );
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
})().catch((e) => {
  console.error(
    e.name,
    e.code || "",
    String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]"),
  );
  process.exitCode = 1;
});
