const assert = require("node:assert/strict");
const { NextRequest } = require("next/server");
const createLoader = require("./lib/investor-test-loader.cjs");
const load = createLoader({ "@/lib/prisma": {} });
const quant = load("src/lib/investor-deals.ts");
const server = load("src/lib/investor-regions.ts");
const benchmark = {
  kelurahanId: "kel-1",
  kelurahanName: "Banyuurip",
  cityId: "city-1",
  cityName: "Kota Surabaya",
  avgPricePerSqm: 7e6,
  sampleCount: 4,
};
function listing(overrides = {}) {
  return {
    id: "1",
    title: "Rumah Banyuurip",
    cityId: "city-1",
    cityName: "Kota Surabaya",
    kelurahanId: "kel-1",
    kelurahanName: "Banyuurip",
    initialAuctionPrice: 1e9,
    currentAuctionPrice: 250e6,
    landAreaSqm: 100,
    imageUrl: "",
    auctionRound: 3,
    auctionDate: "2026-11-19T03:00:00.000Z",
    provinceName: "Jawa Timur",
    districtName: "Sawahan",
    propertyType: "Rumah",
    address: "",
    buildingAreaSqm: 80,
    listingUrl: "/Lelang/rumah-1",
    status: "TERSEDIA",
    coordinates: null,
    auctionHistory: [],
    ...overrides,
  };
}
function raw(id, price, date, overrides = {}) {
  return {
    id_property: BigInt(id),
    judul: `Aset ${id}`,
    slug: `aset-${id}`,
    kategori: "RUMAH",
    status_tayang: "TERSEDIA",
    harga: price,
    nilai_limit_lelang: price,
    tanggal_lelang: new Date(date),
    provinsi: "Jawa Timur",
    kota: "Kota Surabaya",
    kecamatan: "Sawahan",
    kelurahan: "Banyuurip",
    luas_tanah: 100,
    luas_bangunan: 80,
    legalitas: "SHM",
    nomor_legalitas: "000123",
    alamat_lengkap: "Jalan Uji 1",
    gambar: null,
    latitude: null,
    longitude: null,
    ...overrides,
  };
}
async function main() {
  const first = quant.analyzeListing(listing(), benchmark);
  assert.equal(first.pricePerSqm, 2.5e6);
  assert.equal(first.metricAuctionDropPct, 75);
  assert.ok(Math.abs(first.metricMarketSpreadPct - 64.2857142857) < 1e-8);
  assert.equal(first.primaryDealScore, 75 + first.metricMarketSpreadPct);
  assert.equal(first.primaryDealType, "AUCTION_DROP");
  assert.equal(quant.combinedDealScore(80, 90), 170);
  assert.equal(
    quant.combinedDealScore(-10, 90),
    80,
    "Auction increases reduce total points",
  );
  assert.equal(quant.combinedDealScore(null, -10), -10);
  assert.equal(quant.combinedDealScore(0, 0), 0);
  assert.equal(quant.combinedDealScore(null, null), null);
  assert.equal(quant.combinedDealScore(NaN, null), null);
  const onlyAuction = quant.analyzeListing(listing(), null);
  const onlyMarket = quant.analyzeListing(
    listing({ id: "2", initialAuctionPrice: null }),
    benchmark,
  );
  assert.equal(onlyAuction.metricMarketSpreadPct, null);
  assert.equal(onlyMarket.metricAuctionDropPct, null);
  assert.ok(
    quant.isWorthItDeal(onlyAuction, 75, 99),
    "Auction alone meets OR including equality",
  );
  assert.ok(quant.isWorthItDeal(onlyMarket, 99, 60), "Market alone meets OR");
  assert.ok(
    !quant.isWorthItDeal(first, 76, 65),
    "Both below thresholds must fail",
  );
  assert.equal(
    quant.analyzeListing(listing(), { ...benchmark, scope: "KECAMATAN" })
      .metricMarketSpreadPct,
    null,
    "District benchmarks are rejected",
  );
  assert.equal(
    quant.analyzeListing(listing(), {
      ...benchmark,
      scope: "KELURAHAN",
      sampleCount: 1,
    }).metricMarketSpreadPct,
    quant.analyzeListing(listing(), benchmark).metricMarketSpreadPct,
    "One valid local peer is enough",
  );
  const unknown = quant.analyzeListing(
    listing({ initialAuctionPrice: null }),
    null,
  );
  assert.equal(unknown.primaryDealScore, null);
  assert.ok(!quant.isWorthItDeal(unknown, 0, 0));
  const negative = quant.analyzeListing(
    listing({ initialAuctionPrice: null, currentAuctionPrice: 800e6 }),
    benchmark,
  );
  assert.ok(
    negative.primaryDealScore < 0,
    "Missing driver must not turn a negative discount into zero",
  );
  const tie = quant.analyzeListing(
    listing({ initialAuctionPrice: 700e6 }),
    benchmark,
  );
  assert.equal(tie.primaryDealType, "AUCTION_DROP");
  assert.equal(
    quant.analyzeListing(listing({ landAreaSqm: 0 }), benchmark).pricePerSqm,
    null,
  );
  assert.equal(
    quant.analyzeListing(listing({ landAreaSqm: 0 }), benchmark)
      .primaryDealScore,
    75,
    "Bad area must not disable the auction branch",
  );
  assert.equal(
    quant.analyzeListing(listing({ currentAuctionPrice: 0 }), benchmark)
      .primaryDealScore,
    null,
  );
  assert.equal(
    quant.analyzeListing(listing(), { ...benchmark, cityId: "other" })
      .metricMarketSpreadPct,
    null,
  );
  assert.equal(
    quant.analyzeListing(listing(), { ...benchmark, kelurahanId: "other" })
      .metricMarketSpreadPct,
    null,
  );
  assert.equal(
    quant.analyzeListing(listing(), { ...benchmark, avgPricePerSqm: 0 })
      .metricMarketSpreadPct,
    null,
  );
  const marketWinner = quant.analyzeListing(
    listing({ id: "3", currentAuctionPrice: 70e6, initialAuctionPrice: null }),
    benchmark,
  );
  const filters = {
    city: "city-1",
    query: "",
    minSpread: 25,
    minDrop: 25,
    sort: "score",
    savedOnly: false,
    upcomingOnly: false,
  };
  const search = load("src/lib/investor-search.ts");
  const scopeFilters = { ...filters, city: "", dataState: "all" };
  const nonDeals = [
    {
      ...negative,
      id: "21",
      transactionType: "BELI",
      listingCategory: "SECONDARY",
    },
    {
      ...unknown,
      id: "22",
      transactionType: "BELI",
      listingCategory: "SECONDARY",
    },
  ];
  assert.equal(
    quant.selectDeals(nonDeals, {
      ...scopeFilters,
      dataState: "deals",
      listingCategory: "SECONDARY",
    }).length,
    0,
  );
  assert.deepEqual(
    quant
      .selectDeals(nonDeals, { ...scopeFilters, listingCategory: "SECONDARY" })
      .map((item) => item.id),
    ["21", "22"],
    "All listings must include negative and unknown CMA without pretending they are Worth-it",
  );
  const scopedListings = [
    {
      ...first,
      id: "11",
      propertyType: "RUMAH",
      address: "Jalan Investor Nomor 5",
    },
    {
      ...first,
      id: "12",
      propertyType: "TANAH",
      currentAuctionPrice: 600e6,
      landAreaSqm: 250,
    },
    {
      ...first,
      id: "13",
      propertyType: "RUMAH",
      cityName: "Kabupaten Malang",
      provinceName: "Jawa Timur",
      landAreaSqm: null,
    },
    {
      ...first,
      id: "14",
      propertyType: "RUMAH",
      cityName: "Kota Malang",
      provinceName: "Jawa Timur",
    },
  ];
  const ids = (patch) =>
    Array.from(
      quant.selectDeals(scopedListings, { ...scopeFilters, ...patch }),
      (item) => item.id,
    ).sort();
  assert.deepEqual(ids({ propertyTypes: ["TANAH"] }), ["12"]);
  assert.deepEqual(
    ids({ minPrice: 250e6, maxPrice: 250e6, minLand: 100, maxLand: 100 }),
    ["11", "14"],
  );
  assert.deepEqual(
    ids({ minLand: 0 }),
    ["11", "12", "14"],
    "Unknown land is never treated as zero",
  );
  assert.deepEqual(ids({ query: "Jalan Investor Nomor 5" }), ["11"]);
  assert.deepEqual(
    ids({ query: "11" }),
    ["11"],
    "Numeric Home input matches the exact asset ID",
  );
  const cityRegions = [{ id: "3573", name: "Kota Malang", level: "kota" }];
  assert.deepEqual(
    ids({ locations: cityRegions }),
    ["14"],
    "Kota and Kabupaten with the same base name stay separate",
  );
  assert.deepEqual(
    ids({ locations: [{ id: "35", name: "Jawa Timur", level: "provinsi" }] }),
    ["11", "12", "13", "14"],
  );
  const encodedSearch = new URLSearchParams();
  search.writeInvestorSearch(encodedSearch, {
    ...scopeFilters,
    locations: cityRegions,
    propertyTypes: ["RUMAH"],
    maxPrice: 500e6,
    minLand: 100,
  });
  const restoredSearch = search.readInvestorSearch(encodedSearch, true);
  assert.equal(restoredSearch.locations[0].name, "Kota Malang");
  assert.equal(restoredSearch.maxPrice, 500e6);
  assert.equal(restoredSearch.minLand, 100);
  const rentals = [
    {
      ...scopedListings[0],
      id: "21",
      transactionType: "SEWA",
      rentalPeriod: "BULANAN",
    },
    {
      ...scopedListings[0],
      id: "22",
      transactionType: "SEWA",
      rentalPeriod: "TAHUNAN",
    },
  ];
  assert.deepEqual(
    Array.from(
      quant.selectDeals(rentals, {
        ...scopeFilters,
        transactionType: "SEWA",
        rentalPeriod: "BULANAN",
      }),
      (item) => item.id,
    ),
    ["21"],
  );
  const sorted = quant.selectDeals(
    [onlyMarket, onlyAuction, marketWinner],
    filters,
  );
  assert.equal(sorted[0].id, "3");
  assert.equal(
    quant.selectDeals([marketWinner, first], filters)[0].id,
    "1",
    "Combined discounts outrank a larger single discount, before pagination",
  );
  assert.equal(sorted[1].primaryDealScore, 75);
  assert.equal(
    quant.selectDeals([onlyMarket, onlyAuction], {
      ...filters,
      minSpread: 99,
      minDrop: 75,
    }).length,
    1,
  );
  assert.equal(
    quant.selectDeals([first], { ...filters, query: " BANYUURIP " }).length,
    1,
  );
  assert.equal(
    quant.selectDeals([first], { ...filters, savedOnly: true }, []).length,
    0,
  );
  assert.equal(
    quant.selectDeals([first], { ...filters, savedOnly: true }, ["1"]).length,
    1,
  );
  assert.equal(
    quant.selectDeals(
      [quant.analyzeListing(listing({ auctionDate: "2020-01-01" }), benchmark)],
      { ...filters, upcomingOnly: true },
    ).length,
    0,
  );
  assert.equal(
    quant.jakartaDayStart(new Date("2026-10-22T18:30:00Z")),
    Date.parse("2026-10-22T17:00:00Z"),
  );

  const ambiguous = server.buildCityRegistry([
    { provinsi: "Jawa Barat", kota: "Kota Bogor" },
    { provinsi: "Jawa Barat", kota: "Kab. Bogor" },
    { provinsi: "Jawa Barat", kota: "Bogor" },
  ]);
  assert.equal(
    ambiguous.records.size,
    3,
    "City, regency, and ambiguous bare names stay separate",
  );
  assert.equal(
    server.buildCityRegistry([
      { provinsi: "INSI", kota: "Kota Surabaya" },
      { provinsi: "East Java", kota: "Surabaya" },
    ]).records.size,
    1,
    "Reuse the maintained province map for OCR fragments and English aliases",
  );
  assert.equal(quant.calculateRoi(250e6, 700e6, 50e6).profit, 400e6);
  assert.equal(quant.calculateRoi(250e6, 200e6, 0).roi, -20);
  assert.equal(quant.calculateRoi(1e308, 1e308, 1e308), null);

  let session = null,
    role = "OWNER",
    calls = 0;
  const fakePrisma = {
    agent: {
      findUnique: async () => ({
        jabatan: role,
        status_keanggotaan: "AKTIF",
        pengguna: { status_akun: "AKTIF" },
      }),
    },
  };
  const routeLoad = createLoader({
    "next-auth": { getServerSession: async () => session },
    "@/app/api/auth/[...nextauth]/authOptions": { authOptions: {} },
    "@/lib/prisma": fakePrisma,
    "@/lib/investor-deals.server": {
      getCmaValidationProof: async (id) =>
        id === "404" ? null : { listing: { id }, samples: [] },
      getInvestorFeed: async (filters) => {
        calls++;
        return { filters };
      },
    },
  });
  const { GET } = routeLoad("src/app/api/dashboard/investor/route.ts");
  const proofGet = routeLoad(
    "src/app/api/dashboard/investor/[id]/validation/route.ts",
  ).GET;
  const proofRequest = (id = "1") =>
    proofGet(
      new NextRequest(
        `http://localhost/api/dashboard/investor/${id}/validation`,
      ),
      { params: { id } },
    );
  assert.equal((await proofRequest()).status, 401);
  const request = (query = "") =>
    new NextRequest(`http://localhost/api/dashboard/investor${query}`);
  assert.equal((await GET(request())).status, 401);
  assert.equal(calls, 0);
  session = { user: { id: "qa", peran: "AGENT", jabatan: "ADMIN" } };
  assert.equal((await GET(request())).status, 403);
  assert.equal(calls, 0);
  assert.equal((await proofRequest()).status, 403);
  session.user.jabatan = "OWNER";
  role = "ADMIN";
  assert.equal((await GET(request())).status, 403);
  assert.equal(calls, 0);
  role = "OWNER";
  assert.equal((await proofRequest("invalid")).status, 400);
  assert.equal((await proofRequest("404")).status, 404);
  const proofResponse = await proofRequest();
  assert.equal(proofResponse.status, 200);
  assert.equal(proofResponse.headers.get("Cache-Control"), "private, no-store");
  for (const query of [
    "?spread=NaN",
    "?drop=-1",
    "?spread=101",
    "?page=1.5",
    "?ids=not-a-number",
    "?sort=unknown",
    "?minHarga=500&maxHarga=100",
    "?minLT=NaN",
    "?minLT=-1",
    "?minLT=200&maxLT=100",
    "?tipe=FAKE",
    "?durasi=INVALID",
    "?kecamatan=Sawahan",
    "?kelurahan=Banyuurip",
  ])
    assert.equal((await GET(request(query))).status, 400);
  const response = await GET(request("?drop=0&spread=30"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.filters.minDrop, 0);
  assert.equal(body.filters.minSpread, 30);
  assert.equal(body.filters.sort, "score");
  assert.equal(
    body.filters.dataState,
    "all",
    "The default API feed must not hide active non-deals",
  );
  assert.equal(
    (await (await GET(request("?data=deals"))).json()).filters.dataState,
    "deals",
  );
  assert.equal(
    (await (await GET(request("?city=all"))).json()).filters.city,
    "",
  );
  const { getDashboardMenu } = load(
    "src/app/dashboard/components/list-menu.tsx",
  );
  assert.equal(
    JSON.stringify(getDashboardMenu("OWNER").apps.map((item) => item.label)),
    JSON.stringify(["Pemasaran", "Jadwal & Acara", "Scrape", "Investor"]),
  );
  assert.equal(getDashboardMenu("ADMIN").apps.length, 0);
  console.log(
    "Investor checks passed: OR boundaries, signed SUM ranking, unknown/invalid inputs, parent-qualified regions, pagination inputs, fresh owner authorization, and private API responses.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Strict intent/land/geography boundaries for the extended feed contract.
const auctionTarget = listing({
  transactionType: "BELI",
  listingCategory: "LELANG",
  initialAuctionPrice: 1e9,
  currentAuctionPrice: 250e6,
  landAreaSqm: 100,
});
for (const incomplete of [
  { kelurahanId: null },
  { kelurahanName: null },
  { kelurahanName: "   " },
]) {
  const d = quant.analyzeListing(
    { ...auctionTarget, ...incomplete },
    benchmark,
  );
  assert.equal(d.metricMarketSpreadPct, null);
  assert.equal(d.metricAuctionDropPct, 75);
  assert.equal(d.primaryDealScore, 75);
}
const monthly = {
  ...auctionTarget,
  transactionType: "SEWA",
  listingCategory: null,
  rentalPeriod: "BULANAN",
};
assert.equal(
  quant.analyzeListing(monthly, {
    ...benchmark,
    transactionType: "SEWA",
    rentalPeriod: "TAHUNAN",
  }).metricMarketSpreadPct,
  null,
);
assert.equal(
  quant.analyzeListing(monthly, {
    ...benchmark,
    transactionType: "SEWA",
    rentalPeriod: "BULANAN",
  }).metricAuctionDropPct,
  null,
);
assert.equal(
  quant.analyzeListing(
    { ...auctionTarget, listingCategory: "SECONDARY" },
    benchmark,
  ).metricAuctionDropPct,
  null,
);
assert.equal(
  quant.analyzeListing({ ...auctionTarget, landAreaSqm: null }, benchmark)
    .metricMarketSpreadPct,
  null,
);
