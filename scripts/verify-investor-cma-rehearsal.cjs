/** Live-source rehearsal in an isolated schema; always ROLLBACK. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { Client } = require("pg");
const { Prisma } = require("@prisma/client");
require("dotenv").config({ quiet: true });
const client = new Client({ connectionString: process.env.DATABASE_URL });
const bridge = {
  $transaction: async (callback) =>
    callback({
      $queryRaw: async (query, ...values) => {
        const sql = Array.isArray(query) ? Prisma.sql(query, ...values) : query;
        return (await client.query(sql.text, sql.values)).rows;
      },
    }),
};
const load = require("./lib/investor-test-loader.cjs")({
  "@/lib/prisma": bridge,
  "@/lib/investor-read.server": {
    withInvestorRead: (callback) => bridge.$transaction(callback),
  },
});
(async () => {
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='180s'");
    const schema = `investor_rehearsal_${process.pid}`;
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
      "INSERT INTO listing_sewa_detail SELECT * FROM public.listing_sewa_detail",
    );
    const cols =
      "id_property,id_agent,judul,slug,jenis_transaksi,kategori,status_tayang,harga,nilai_limit_lelang,tanggal_lelang,provinsi,kota,kecamatan,kelurahan,alamat_lengkap,luas_tanah,latitude,longitude,legalitas,nomor_legalitas,gambar,bukan_properti,tanggal_dibuat,tanggal_diupdate,harga_promo";
    await client.query(
      `INSERT INTO listing(${cols}) SELECT ${cols} FROM public.listing WHERE jenis_transaksi::text IN('PRIMARY','LELANG','SECONDARY','SEWA')`,
    );
    await client.query(
      fs.readFileSync("prisma/migration_investor_intent_v2.sql", "utf8"),
    );
    const { buildCityRegistry } = load("src/lib/investor-regions.ts");
    const registry = buildCityRegistry(
      (await client.query("SELECT DISTINCT provinsi,kota FROM listing")).rows,
    );
    const aliases = new Map();
    for (const city of registry.records.values())
      for (const region of city.regions)
        aliases.set(JSON.stringify([region.provinsi || "", region.kota]), [
          region.provinsi || "",
          region.kota,
          city.id,
          city.name,
          city.provinceName,
        ]);
    await client.query(
      `INSERT INTO investor_city_aliases SELECT v->>0,v->>1,v->>2,v->>3,v->>4 FROM jsonb_array_elements($1::jsonb) v`,
      [JSON.stringify([...aliases.values()])],
    );
    const begin = Date.now();
    await client.query("SELECT investor_v2_sync(NULL)");
    await client.query("ANALYZE investor_listing_valuations");
    await client.query("ANALYZE investor_source_scopes");
    const { getInvestorFeed, getCmaValidationProof } = load(
      "src/lib/investor-deals.server.ts",
    );
    const filters = {
      city: "Kota Surabaya",
      query: "",
      minSpread: 25,
      minDrop: 25,
      sort: "score",
      savedOnly: false,
      upcomingOnly: false,
    };
    const backfillMs = Date.now() - begin;
    const rental = await getInvestorFeed(
      { ...filters, transactionType: "SEWA", dataState: "all" },
      1,
      "grid",
      [],
    );
    assert.ok(
      rental.items.every(
        (p) => p.transactionType === "SEWA" && p.metricAuctionDropPct === null,
      ),
    );
    const start = Date.now();
    const first = await getInvestorFeed(filters, 1, "grid", []);
    assert.ok(first.items.length > 0);
    assert.ok(
      first.items.every(
        (p, i) =>
          !i || first.items[i - 1].primaryDealScore >= p.primaryDealScore,
      ),
    );
    const second = await getInvestorFeed(filters, 2, "table", []);
    assert.ok(
      second.items.every((p) => !first.items.some((a) => a.id === p.id)),
    );
    const proof = await getCmaValidationProof(first.items[0].id);
    assert.ok(proof.samples.length <= 10);
    assert.ok(
      proof.samples.every(
        (p) =>
          p.assetCode !== proof.listing.assetCode &&
          p.propertyType === proof.listing.propertyType,
      ),
    );
    const sbyMs = Date.now() - start;
    const nationalStart = Date.now();
    const national = await getInvestorFeed(
      { ...filters, city: "" },
      1,
      "map",
      [],
    );
    assert.ok(national.total >= first.total && national.items.length <= 200);
    assert.ok(
      national.items.every(
        (p, i) =>
          !i || national.items[i - 1].primaryDealScore >= p.primaryDealScore,
      ),
    );
    const noResults = await getInvestorFeed(
      { ...filters, query: "nosuchlocationfixture" },
      999,
      "grid",
      [],
    );
    assert.equal(noResults.total, 0);
    assert.equal(noResults.page, 1);
    const saved = await getInvestorFeed(
      { ...filters, savedOnly: true },
      1,
      "grid",
      [first.items[0].id],
    );
    assert.equal(saved.total, 1);
    const {
      rows: [bad],
    } =
      await client.query(`SELECT count(*)::int n FROM investor_listing_valuations l WHERE
   l.harga_per_meter IS DISTINCT FROM l.harga_lelang_pertama/nullif(l.luas_tanah_m2,0)
   OR l.primary_deal_score IS DISTINCT FROM (CASE WHEN l.metric_auction_drop_pct IS NULL AND l.metric_market_spread_pct IS NULL THEN NULL ELSE coalesce(l.metric_auction_drop_pct,0)+coalesce(l.metric_market_spread_pct,0) END)
   OR NOT EXISTS(SELECT 1 FROM listing s WHERE s.id_property=l.source_listing_id)`);
    assert.equal(bad.n, 0);
    console.log(
      JSON.stringify({
        mode: "isolated live-source rehearsal, rolled back",
        backfillMs,
        cityQueryAndProofMs: sbyMs,
        nationalQueriesMs: Date.now() - nationalStart,
        activeAssets: national.summary.activeListings,
        cityDeals: first.total,
        nationalDeals: national.total,
        proofRows: proof.samples.length,
      }),
    );
    await client.query("ROLLBACK");
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
})().catch((error) => {
  console.error(
    error.name,
    error.code || "",
    String(error.message).replace(
      /postgres(?:ql)?:\/\/[^\s]+/g,
      "[database URL]",
    ),
  );
  process.exitCode = 1;
});
