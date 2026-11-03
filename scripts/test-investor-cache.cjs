/** A correction must supersede in-flight pre-correction snapshots. No database. */
const assert = require("node:assert/strict");
const load = require("./lib/investor-test-loader.cjs")({ "@/lib/prisma": {} });
const {
  getLegacyInvestorFeed,
  getCachedInvestorFeed,
  getCachedCmaProof,
  getMarketingInvestorCandidates,
  getMarketingInvestorScope,
  invalidateInvestorCache,
} = load("src/lib/investor-cma-legacy.server.ts");
const defer = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const started = [defer(), defer()],
  finish = [defer(), defer()];
let queries = 0;
let rawQueries = 0;
const row = (title) => ({
  id: "1",
  asset_code: "UNVERIFIED-1",
  source_listing_id: 1n,
  initial_source_id: null,
  initial_auction_date: null,
  identity_verified: false,
  city_id: "JAWATIMUR/KOTA/SURABAYA",
  city_name: "Kota Surabaya",
  province_name: "Jawa Timur",
  district_id: "district",
  district_name: "Karangpilang",
  kelurahan_id: null,
  kelurahan_name: null,
  property_type: "RUMAH",
  transaction_type: "BELI",
  listing_category: "PRIMARY",
  rental_period: null,
  market_eligible: false,
  judul: title,
  slug: "fixture",
  gambar: null,
  alamat_lengkap: "",
  harga_lelang_pertama: null,
  harga_lelang_terakhir: 250e6,
  luas_tanah_m2: 100,
  harga_per_meter: null,
  current_price_per_meter: 2.5e6,
  market_basis_per_meter: 2.5e6,
  metric_auction_drop_pct: null,
  metric_market_spread_pct: null,
  primary_deal_score: null,
  primary_deal_type: null,
  benchmark_avg: null,
  benchmark_count: 0,
  kelurahan_sample_count: 0,
  benchmark_scope: "NONE",
  benchmark_version: new Date(),
  updated_at: new Date(),
  history: [],
  auction_round: 1,
  tanggal_lelang: null,
  latitude: null,
  longitude: null,
  source_revision: "a".repeat(32),
});
const tx = {
  $queryRaw: async (query) => {
    rawQueries++;
    const text = Array.isArray(query) ? query.join("?") : query.sql;
    if (text.includes("SELECT DISTINCT provinsi,kota"))
      return [{ provinsi: "Jawa Timur", kota: "Kota Surabaya" }];
    if (text.includes("set_config")) return [];
    if (text.includes("SELECT id_property::text id,gambar"))
      return [{ id: "1", gambar: null }];
    if (text.includes("to_regclass")) return [{ ready: false }];
    const n = queries++;
    assert.ok(n < 2, "Old completion must not evict a fresh pending flight");
    started[n].resolve();
    await finish[n].promise;
    return [row(n ? "New" : "Old")];
  },
};
const filters = {
  transactionType: "BELI",
  listingCategory: "ALL",
  dataState: "all",
  city: "Kota Surabaya",
  query: "",
  minSpread: 25,
  minDrop: 25,
  sort: "score",
  savedOnly: false,
  upcomingOnly: false,
};
(async () => {
  const old = getLegacyInvestorFeed(tx, filters, 1, "grid", []);
  await started[0].promise;
  invalidateInvestorCache();
  const fresh = getLegacyInvestorFeed(tx, filters, 1, "grid", []);
  await started[1].promise;
  finish[0].resolve();
  await old;
  const coalesced = getLegacyInvestorFeed(tx, filters, 1, "grid", []);
  await new Promise((r) => setImmediate(r));
  finish[1].resolve();
  assert.equal((await fresh).items[0].title, "New");
  assert.equal((await coalesced).items[0].title, "New");
  const beforeWarm = rawQueries;
  const cached = await getLegacyInvestorFeed(tx, filters, 1, "grid", []);
  assert.equal(
    rawQueries,
    beforeWarm,
    "Warm reads must perform zero database queries",
  );
  assert.deepEqual(getCachedInvestorFeed(filters, 1, "grid", []), cached);
  assert.equal(getCachedCmaProof("1").listing.title, "New");
  assert.equal(getCachedCmaProof("1").expandedToDistrict, false);
  assert.equal(rawQueries, beforeWarm);
  assert.equal(cached.items[0].title, "New");
  assert.equal(cached.summary.matchingListingsCount, 1);
  const noQualified = await getLegacyInvestorFeed(
    tx,
    { ...filters, dataState: "deals" },
    1,
    "grid",
    [],
  );
  assert.equal(noQualified.total, 0);
  assert.equal(
    noQualified.summary.matchingListingsCount,
    1,
    "A real non-deal is available for scope recovery",
  );
  for (const extra of [
    { query: "kelurahan-tidak-ada" },
    { savedOnly: true },
    { upcomingOnly: true },
    { minLand: 110000 },
    { minPrice: 1e9 },
  ]) {
    const unmatched = await getLegacyInvestorFeed(
      tx,
      { ...filters, ...extra, dataState: "deals" },
      1,
      "grid",
      [],
    );
    assert.equal(unmatched.total, 0);
    assert.equal(
      unmatched.summary.matchingListingsCount,
      0,
      `Do not broaden a real mismatch: ${Object.keys(extra)[0]}`,
    );
  }
  assert.equal(queries, 2);
  let marketingQueries = 0;
  const marketingReader = {
    $queryRaw: async (query) => {
      marketingQueries++;
      const text = Array.isArray(query) ? query.join("?") : query.sql;
      if (text.includes("SELECT DISTINCT provinsi,kota"))
        return [{ provinsi: "Jawa Timur", kota: "Kota Surabaya" }];
      if (text.includes("set_config")) return [];
      if (text.includes("SELECT id_property::text id,gambar"))
        return [{ id: "2", gambar: "/images/hero/pasinan1.jpg" }];
      assert.ok(
        text.includes("WITH aliases AS"),
        "Extra categories use canonical source valuations rather than the four-type read model",
      );
      assert.ok(
        query.values.some(
          (value) =>
            Array.isArray(value) &&
            value.includes("GUDANG") &&
            value.includes("HOTEL_DAN_VILLA"),
        ),
      );
      return [
        {
          ...row("Gudang"),
          id: "2",
          source_listing_id: 2n,
          asset_code: "UNVERIFIED-2",
          property_type: "GUDANG",
        },
      ];
    },
  };
  const scope = await getMarketingInvestorScope(marketingReader, {
    ...filters,
    propertyTypes: ["GUDANG"],
  });
  assert.equal(scope.length, 1);
  assert.equal(
    scope[0].imageUrls.length,
    0,
    "inventory diagnostics never hydrate media",
  );
  const extra = await getMarketingInvestorCandidates(
    marketingReader,
    { ...filters, propertyTypes: ["GUDANG"] },
    new Set(),
    0,
    30,
    () => true,
    false,
  );
  assert.equal(extra.items[0].propertyType, "GUDANG");
  assert.equal(extra.items[0].imageUrls.join(","), "/images/hero/pasinan1.jpg");
  const beforeMarketingWarm = marketingQueries;
  await getMarketingInvestorCandidates(
    marketingReader,
    { ...filters, propertyTypes: ["GUDANG"] },
    new Set(),
    0,
    30,
    () => true,
    false,
  );
  assert.equal(
    marketingQueries,
    beforeMarketingWarm,
    "Extended marketing categories retain the warm cache",
  );
  assert.equal(
    getCachedInvestorFeed(filters, 1, "grid", []).items[0].title,
    "New",
    "Marketing's additional categories do not replace the Investor feed cache",
  );
  console.log(
    "Cache correction race passed: old snapshots cannot repopulate the cache or evict a newer request; fresh reads coalesce; warm feed/proof reads use zero DB queries; filtered responses reuse the validated snapshot.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
