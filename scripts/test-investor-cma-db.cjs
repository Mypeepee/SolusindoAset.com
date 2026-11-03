/** v2 pipeline tests in an isolated schema. Always ROLLBACK; no public writes. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { Client } = require("pg");
const { Prisma } = require("@prisma/client");
const {
  event,
  kebraonEvents,
  expectedAverage,
} = require("./fixtures/investor-cma.cjs");
require("dotenv").config({ quiet: true });
const client = new Client({ connectionString: process.env.DATABASE_URL });
const near = (a, b) =>
  assert.ok(
    Math.abs(Number(a) - b) < Math.max(1e-7, Math.abs(b) * 1e-12),
    `${a} != ${b}`,
  );
const bridge = {
  $transaction: async (cb) =>
    cb({
      $queryRaw: async (q, ...values) => {
        const s = Array.isArray(q) ? Prisma.sql(q, ...values) : q;
        let i = 0;
        return (
          await client.query(
            s.sql.replace(/\?/g, () => `$${++i}`),
            s.values,
          )
        ).rows;
      },
    }),
};
const load = require("./lib/investor-test-loader.cjs")({
  "@/lib/prisma": bridge,
  "@/lib/investor-read.server": {
    withInvestorRead: (callback) => bridge.$transaction(callback),
  },
});
async function insert(rows) {
  const cols = [...new Set(rows.flatMap(Object.keys))];
  for (const row of rows)
    await client.query(
      `INSERT INTO listing(${cols.join(",")}) VALUES(${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      cols.map((k) => row[k] ?? null),
    );
}
async function row(id) {
  return (
    await client.query(
      "SELECT * FROM investor_listing_valuations WHERE id=$1",
      [String(id)],
    )
  ).rows[0];
}
async function parity() {
  const { legacyCmaQuery } = load("src/lib/investor-cma-legacy.server.ts");
  const { buildCityRegistry } = load("src/lib/investor-regions.ts");
  const registry = buildCityRegistry([
    { provinsi: "Jawa Timur", kota: "Kota Surabaya" },
  ]);
  for (const intent of ["BELI", "SEWA"]) {
    const q = legacyCmaQuery(registry, "", intent);
    let i = 0;
    const derived = (
      await client.query(
        q.sql.replace(/\?/g, () => `$${++i}`),
        q.values,
      )
    ).rows;
    const stored = (
      await client.query(
        "SELECT * FROM investor_listing_valuations WHERE transaction_type=$1",
        [intent],
      )
    ).rows;
    assert.equal(derived.length, stored.length);
    for (const expected of stored) {
      const actual = derived.find((r) => r.id === expected.id);
      assert.ok(actual);
      for (const key of [
        "asset_code",
        "transaction_type",
        "listing_category",
        "rental_period",
        "property_type",
        "market_eligible",
        "benchmark_count",
        "kelurahan_sample_count",
        "benchmark_scope",
        "primary_deal_type",
      ])
        assert.equal(actual[key], expected[key], `${key} of ${expected.id}`);
      for (const key of [
        "harga_lelang_pertama",
        "harga_lelang_terakhir",
        "harga_per_meter",
        "current_price_per_meter",
        "market_basis_per_meter",
        "benchmark_avg",
        "metric_auction_drop_pct",
        "metric_market_spread_pct",
        "primary_deal_score",
      ])
        expected[key] === null
          ? assert.equal(actual[key], null)
          : near(actual[key], Number(expected[key]));
    }
  }
}
(async () => {
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='30s'");
    const schema = `investor_v2_test_${process.pid}`;
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema},public`);
    await client.query(
      "CREATE TABLE listing (LIKE public.listing INCLUDING DEFAULTS INCLUDING CONSTRAINTS)",
    );
    await client.query("ALTER TABLE listing ADD PRIMARY KEY(id_property)");
    await client.query(
      "CREATE TABLE listing_sewa_detail (LIKE public.listing_sewa_detail INCLUDING DEFAULTS INCLUDING CONSTRAINTS)",
    );
    await client.query(
      "ALTER TABLE listing_sewa_detail ADD PRIMARY KEY(id_property)",
    );
    await client.query(
      fs.readFileSync("prisma/migration_investor_intent_v2.sql", "utf8"),
    );
    await client.query(
      "INSERT INTO investor_city_aliases VALUES('Jawa Timur','Kota Surabaya','JAWATIMUR/KOTA/SURABAYA','Kota Surabaya','Jawa Timur')",
    );
    await insert(kebraonEvents);
    await client.query("SELECT investor_v2_sync(NULL)");
    const target = await row(-106);
    near(target.benchmark_avg, expectedAverage);
    assert.equal(target.benchmark_count, 3);
    near(target.harga_per_meter, 1e7);
    near(target.current_price_per_meter, 2.5e6);
    near(target.metric_auction_drop_pct, 75);
    assert.equal(
      (
        await client.query(
          "SELECT count(*)::int n FROM investor_listing_valuations WHERE id IN('-101','-102')",
        )
      ).rows[0].n,
      1,
    );
    await parity();
    // Buy aggregates Primary + Secondary + Lelang, using offer prices for non-auctions.
    await insert([
      event(-201, "201", 600e6, 100, {
        jenis_transaksi: "PRIMARY",
        kelurahan: "Kedurus",
      }),
      event(-202, "202", 800e6, 100, {
        jenis_transaksi: "SECONDARY",
        kelurahan: "Kedurus",
      }),
    ]);
    assert.equal((await row(-201)).harga_lelang_pertama, null);
    assert.equal((await row(-201)).metric_auction_drop_pct, null);
    near((await row(-201)).market_basis_per_meter, 6e6);
    await client.query(
      "INSERT INTO listing_sewa_detail(id_property,durasi_sewa,harga_sewa_bulanan) VALUES(-201,'BULANAN',1000000)",
    );
    near((await row(-201)).harga_lelang_terakhir, 600e6);
    near((await row(-201)).market_basis_per_meter, 6e6);
    const local = await row(-201);
    assert.equal(local.benchmark_scope, "KELURAHAN");
    assert.equal(local.benchmark_count, 1);
    near(local.benchmark_avg, 8e6);
    near(local.metric_market_spread_pct, 25);
    near((await row(-202)).benchmark_avg, 6e6);
    // With one remaining physical asset there is no benchmark, despite district peers.
    await client.query(
      "UPDATE listing SET status_tayang='TARIK_LISTING' WHERE id_property=-202",
    );
    assert.equal((await row(-201)).benchmark_count, 0);
    assert.equal((await row(-201)).benchmark_avg, null);
    assert.equal((await row(-201)).benchmark_scope, "NONE");
    await client.query(
      "UPDATE listing SET status_tayang='TERSEDIA' WHERE id_property=-202",
    );
    assert.equal((await row(-201)).benchmark_count, 1);
    // Missing kelurahan is completely excluded as target and peer, even with district peers.
    await insert([
      event(-301, "301", 200e6, 100, { kelurahan: null }),
      event(-302, "302", 200e6, -100),
    ]);
    const missing = await row(-301);
    assert.equal(missing.kelurahan_id, null);
    assert.equal(missing.market_eligible, false);
    assert.equal(missing.metric_market_spread_pct, null);
    assert.equal(missing.benchmark_avg, null);
    assert.equal((await row(-302)).current_price_per_meter, null);
    // Building area changes cannot change a single valuation result.
    const before = await row(-106);
    await client.query(
      "UPDATE listing SET luas_bangunan=999999 WHERE id_property=-106",
    );
    const after = await row(-106);
    assert.equal(before.primary_deal_score, after.primary_deal_score);
    assert.equal(after.benchmark_avg, before.benchmark_avg);
    // Rentals are independent, and monthly/annual prices never share a benchmark.
    await insert([
      event(-401, "401", 10e6, 100, { jenis_transaksi: "SEWA" }),
      event(-402, "402", 20e6, 100, { jenis_transaksi: "SEWA" }),
      event(-403, "403", 30e6, 100, { jenis_transaksi: "SEWA" }),
      event(-404, "404", 5e6, 100, { jenis_transaksi: "SEWA" }),
      event(-405, "405", 900e6, 100, { jenis_transaksi: "SEWA" }),
    ]);
    for (const id of [-401, -402, -403, -404])
      await client.query(
        "INSERT INTO listing_sewa_detail(id_property,durasi_sewa,harga_sewa_bulanan) VALUES($1,'BULANAN',$2)",
        [
          id,
          (
            await client.query(
              "SELECT harga FROM listing WHERE id_property=$1",
              [id],
            )
          ).rows[0].harga,
        ],
      );
    await client.query(
      "INSERT INTO listing_sewa_detail(id_property,durasi_sewa,harga_sewa_tahunan) VALUES(-405,'TAHUNAN',900000000)",
    );
    const rent = await row(-404);
    assert.equal(rent.transaction_type, "SEWA");
    assert.equal(rent.listing_category, null);
    assert.equal(rent.metric_auction_drop_pct, null);
    assert.equal(rent.benchmark_count, 3);
    near(rent.benchmark_avg, 200000);
    near(rent.metric_market_spread_pct, 75);
    assert.equal((await row(-405)).benchmark_avg, null);
    const buyAfterRent = await row(-106);
    near(buyAfterRent.benchmark_avg, expectedAverage);
    // Explicit rental intent in a malformed auction title never appears in Buy.
    await insert([event(-410, "410", 1e6, 100, { judul: "Sewa Woodland" })]);
    assert.equal((await row(-410)).transaction_type, "SEWA");
    assert.equal((await row(-410)).rental_period, null);
    assert.equal((await row(-410)).metric_market_spread_pct, null);
    // The same physical certificate can be available independently for buy and rent.
    await insert([event(-420, "9001", 1e6, 100, { jenis_transaksi: "SEWA" })]);
    assert.equal((await row(-420)).asset_code, (await row(-106)).asset_code);
    assert.equal(
      (
        await client.query(
          "SELECT count(*)::int n FROM investor_listing_valuations WHERE asset_code=$1",
          [(await row(-106)).asset_code],
        )
      ).rows[0].n,
      2,
    );
    await parity();
    // Source, rental detail, latest deletion, and correction triggers update stored values.
    await client.query(
      "UPDATE listing SET harga=100000000,nilai_limit_lelang=100000000 WHERE id_property=-106",
    );
    near((await row(-106)).metric_auction_drop_pct, 90);
    await client.query(
      "UPDATE listing_sewa_detail SET harga_sewa_bulanan=10000000 WHERE id_property=-404",
    );
    near((await row(-404)).current_price_per_meter, 100000);
    await client.query("DELETE FROM listing WHERE id_property=-102");
    assert.ok(await row(-101));
    await client.query(
      "UPDATE listing SET kecamatan='Karangpilang',kelurahan='Kebraon' WHERE id_property=-301",
    );
    assert.equal((await row(-301)).market_eligible, true);
    await insert(
      Array.from({ length: 12 }, (_, i) =>
        event(-500 - i, String(500 + i), (i + 1) * 100e6, 100),
      ),
    );
    const { getCmaValidationProof } = load("src/lib/investor-deals.server.ts");
    await insert([event(99106, "99106", 250e6, 100)]);
    const proof = await getCmaValidationProof("99106");
    assert.equal(proof.samples.length, 9);
    assert.ok(
      proof.samples.every(
        (peer, i, rows) =>
          i === 0 ||
          rows[i - 1].baselinePricePerSqm >= peer.baselinePricePerSqm,
      ),
    );
    assert.ok(proof.minBaselinePricePerSqm > 0);
    assert.equal(
      proof.cheapestPeer.baselinePricePerSqm,
      proof.minBaselinePricePerSqm,
    );
    assert.ok(!proof.samples.some((peer) => peer.id === proof.cheapestPeer.id));
    assert.ok(
      proof.samples.every(
        (peer) => peer.id !== proof.listing.id && peer.imageUrl !== undefined,
      ),
    );
    assert.ok(proof.benchmark.sampleCount > 10);
    const aggregate = (
      await client.query(`SELECT AVG(p.market_basis_per_meter) AS average,
      MIN(p.market_basis_per_meter) AS minimum, COUNT(*) AS count
      FROM investor_listing_valuations p JOIN investor_listing_valuations t ON t.id='99106'
      WHERE p.identity_verified AND p.market_eligible AND p.market_basis_per_meter>0
      AND p.asset_code<>t.asset_code AND p.property_type=t.property_type
      AND p.transaction_type=t.transaction_type AND p.rental_period IS NOT DISTINCT FROM t.rental_period
      AND p.kelurahan_id=t.kelurahan_id`)
    ).rows[0];
    near(proof.benchmark.avgPricePerSqm, Number(aggregate.average));
    near(proof.minBaselinePricePerSqm, Number(aggregate.minimum));
    assert.equal(proof.benchmark.sampleCount, Number(aggregate.count));
    await insert([
      event(-600, "600", 1e9, 100, { tanggal_lelang: "2025-01-01" }),
      event(-599, "600", 0, 100),
    ]);
    assert.equal(await row(-600), undefined);
    assert.equal(await row(-599), undefined);
    // Investor must qualify/rank using the shared history matcher, not raw CMA asset keys.
    await insert([
      event(99201, "99200", 1e9, 100, { tanggal_lelang: "2024-01-01" }),
      event(99202, "99200", 250e6, 500), // same key, different land parcel: NO auction drop
      event(99301, "99300", 1e9, 100, {
        tanggal_lelang: "2024-01-01",
        kelurahan: null,
      }),
      event(99302, "99300", 250e6, 100), // mature history matches the incomplete old region
    ]);
    await insert([
      event(99401, "99400", 1e9, 100, { nilai_limit_lelang: null }),
      event(99402, "99400", 250e6, 100, { nilai_limit_lelang: null }),
    ]);
    const { getInvestorFeed } = load("src/lib/investor-deals.server.ts");
    const ranked = await getInvestorFeed(
      {
        city: "Kota Surabaya",
        transactionType: "BELI",
        listingCategory: "ALL",
        dataState: "deals",
        query: "",
        minSpread: 100,
        minDrop: 70,
        sort: "drop",
        savedOnly: true,
        upcomingOnly: false,
      },
      1,
      "grid",
      ["99202", "99302"],
      true,
    );
    assert.equal(ranked.total, 1);
    assert.equal(ranked.items[0].id, "99302");
    near(ranked.items[0].metricAuctionDropPct, 75);
    near(ranked.items[0].initialAuctionPrice, 1e9);
    const duplicateOnly = await getInvestorFeed(
      {
        city: "Kota Surabaya",
        dataState: "all",
        query: "",
        minSpread: 0,
        minDrop: 0,
        sort: "score",
        savedOnly: true,
        upcomingOnly: false,
      },
      1,
      "grid",
      ["99402"],
    );
    assert.equal(duplicateOnly.items[0].metricAuctionDropPct, null);
    assert.equal(duplicateOnly.items[0].auctionRound, 1);
    const falseDeal = await getInvestorFeed(
      {
        city: "Kota Surabaya",
        dataState: "all",
        query: "",
        minSpread: 0,
        minDrop: 0,
        sort: "score",
        savedOnly: true,
        upcomingOnly: false,
      },
      1,
      "grid",
      ["99202"],
    );
    assert.equal(falseDeal.items[0].metricAuctionDropPct, null);
    await client.query(
      "UPDATE listing SET kecamatan='AA Test District',kelurahan='Kebraon' WHERE id_property=-201",
    );
    assert.match((await row(-201)).district_id, /AATEST/);
    await client.query(
      "UPDATE listing SET kecamatan='Karangpilang',kelurahan='Kedurus' WHERE id_property=-201",
    );
    assert.match((await row(-201)).district_id, /KARANGPILANG/);
    await parity();
    await client.query("ROLLBACK");
    console.log(
      "Investor v2 passed: canonical/stored parity, BUY categories, RENT period isolation, missing kelurahan exclusion, land-only metrics, physical deduplication per intent, kelurahan-only one-peer/zero-peer CMA, max-10 proof and ingestion/update/delete/correction triggers. All isolated fixtures rolled back.",
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
