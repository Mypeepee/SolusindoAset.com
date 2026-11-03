/** Atomic, additive install/backfill. Default is a complete ROLLBACK rehearsal.
 * --apply commits the read model and source ingestion triggers. No source price
 * or existing harga_per_meter is changed. Never logs credentials/source rows.
 */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { Client } = require("pg");
require("dotenv").config({ quiet: true });
const load = require("./lib/investor-test-loader.cjs")({ "@/lib/prisma": {} });
const { buildCityRegistry } = load("src/lib/investor-regions.ts");
const apply = process.argv.includes("--apply");
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='180s'");
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("LOCK TABLE listing IN SHARE ROW EXCLUSIVE MODE");
    await client.query(
      fs.readFileSync("prisma/migration_investor_intent_v2.sql", "utf8"),
    );
    const { rows } = await client.query(
      "SELECT DISTINCT provinsi,kota FROM listing WHERE jenis_transaksi::text IN('PRIMARY','LELANG','SECONDARY','SEWA')",
    );
    const registry = buildCityRegistry(rows);
    const aliasMap = new Map();
    for (const city of registry.records.values())
      for (const region of city.regions)
        aliasMap.set(JSON.stringify([region.provinsi || "", region.kota]), {
          raw_province: region.provinsi || "",
          raw_city: region.kota,
          city_id: city.id,
          city_name: city.name,
          province_name: city.provinceName,
        });
    const aliases = [...aliasMap.values()];
    await client.query(
      `INSERT INTO investor_city_aliases SELECT * FROM jsonb_to_recordset($1::jsonb)
   AS r(raw_province text,raw_city text,city_id text,city_name text,province_name text)
   ON CONFLICT(raw_province,raw_city) DO UPDATE SET city_id=excluded.city_id,city_name=excluded.city_name,province_name=excluded.province_name`,
      [JSON.stringify(aliases)],
    );
    await client.query("SELECT investor_v2_sync(NULL)");
    const {
      rows: [stats],
    } =
      await client.query(`SELECT count(*)::int assets,count(*) FILTER(WHERE is_latest)::int active,
    count(*) FILTER(WHERE is_latest AND identity_verified AND market_eligible AND market_basis_per_meter>0)::int eligible_peers,
    count(*) FILTER(WHERE is_latest AND benchmark_count>0)::int benchmark_coverage FROM investor_listing_valuations`);
    const {
      rows: [bad],
    } =
      await client.query(`SELECT count(*)::int n FROM investor_listing_valuations WHERE
   harga_per_meter IS DISTINCT FROM harga_lelang_pertama/nullif(luas_tanah_m2,0)
   OR current_price_per_meter IS DISTINCT FROM harga_lelang_terakhir/nullif(luas_tanah_m2,0)
   OR primary_deal_score IS DISTINCT FROM greatest(metric_auction_drop_pct,metric_market_spread_pct)`);
    assert.equal(bad.n, 0, "Stored ratios and MAX must agree with baselines");
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(
      JSON.stringify({
        mode: apply ? "committed" : "rollback rehearsal passed",
        ...stats,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
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
