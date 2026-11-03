/** Synthetic network fixtures for browser interaction tests, never imported by the app. */
const createLoader = require("../lib/investor-test-loader.cjs");
const load = createLoader();
const quant = load("src/lib/investor-deals.ts");
const search = load("src/lib/investor-search.ts");
const cities = [
  { id: "city-sby", name: "Kota Surabaya", provinceName: "Jawa Timur" },
  { id: "city-mlg", name: "Kota Malang", provinceName: "Jawa Timur" },
];
function property(
  id,
  title,
  price,
  initial,
  area,
  kel = "Banyuurip",
  average = 7e6,
  cityId = "city-sby",
  extra = {},
) {
  const city = cities.find((item) => item.id === cityId);
  const kelurahanId = kel ? `${cityId}/${kel}` : null;
  return quant.analyzeListing(
    {
      id: String(id),
      title,
      cityId,
      cityName: city.name,
      kelurahanId,
      kelurahanName: kel,
      currentAuctionPrice: price,
      initialAuctionPrice: initial,
      landAreaSqm: area,
      imageUrl: "/images/hero/balongsari.jpeg",
      imageUrls: [
        "/images/hero/balongsari.jpeg",
        "/images/hero/pasinan1.jpg",
        "/images/hero/pasinan2.jpg",
      ],
      auctionRound: initial ? 2 : 1,
      auctionDate: "2026-11-19T03:00:00.000Z",
      provinceName: "Jawa Timur",
      districtName: kel === "Rungkut" ? "Rungkut" : "Sawahan",
      address: `Kawasan uji ${kel}`,
      propertyType: "RUMAH",
      certificateType: "SHM",
      transactionType: "BELI",
      listingCategory: initial ? "LELANG" : "PRIMARY",
      kelurahanVerified: !!kel,
      rentalPeriod: null,
      sourceRevision: "a".repeat(32),
      listingUrl: `/Lelang/qa-${id}`,
      status: "TERSEDIA",
      coordinates: {
        latitude: -7.26 - (id % 7) * 0.006,
        longitude: 112.7 + (id % 7) * 0.012,
      },
      auctionHistory: initial
        ? [{ round: 1, date: "2025-01-01T03:00:00.000Z", limitPrice: initial }]
        : [],
      ...extra,
    },
    average === null
      ? null
      : {
          kelurahanId,
          kelurahanName: kel,
          cityId,
          cityName: city.name,
          avgPricePerSqm: average,
          scope: "KELURAHAN",
          sampleCount: 4,
          transactionType: extra.transactionType || "BELI",
          rentalPeriod: extra.rentalPeriod || null,
        },
  );
}
const listings = [
  property(901, "Rumah sudut Banyuurip", 250e6, 1e9, 100),
  property(902, "Rumah dengan spread 90 persen", 70e6, null, 100),
  property(903, "Rumah dengan penurunan 80 persen", 630e6, 3150e6, 100),
  property(
    904,
    "Rumah keluarga Balongsari",
    480e6,
    1200e6,
    160,
    "Balongsari",
    8e6,
  ),
  property(905, "Ruko dua lantai Rungkut", 900e6, 2e9, 180, "Rungkut", 10e6),
  property(
    906,
    "Rumah tanpa pembanding pasar",
    300e6,
    1e9,
    100,
    "Wonokromo",
    null,
  ),
  property(907, "Rumah dengan CMA saja", 350e6, null, 100, "Mulyorejo"),
  property(
    908,
    "Rumah di atas pasar",
    960e6,
    null,
    100,
    "Balongsari",
    8e6,
    "city-sby",
    { listingCategory: "SECONDARY" },
  ),
  property(
    909,
    "Rumah Malang",
    360e6,
    900e6,
    120,
    "Tulusrejo",
    6e6,
    "city-mlg",
  ),
];
listings.push(
  property(
    910,
    "Rumah lokasi belum diverifikasi",
    200e6,
    null,
    100,
    null,
    null,
    "city-sby",
    { listingCategory: "SECONDARY" },
  ),
);
listings.push(
  property(
    920,
    "Sewa rumah bulanan",
    5e6,
    null,
    100,
    "Banyuurip",
    200000,
    "city-sby",
    { transactionType: "SEWA", listingCategory: null, rentalPeriod: "BULANAN" },
  ),
);
listings.push(
  property(
    921,
    "Sewa rumah tahunan",
    60e6,
    null,
    100,
    "Banyuurip",
    800000,
    "city-sby",
    { transactionType: "SEWA", listingCategory: null, rentalPeriod: "TAHUNAN" },
  ),
);
listings.push(
  property(
    922,
    "Sewa periode belum tersedia",
    10e6,
    null,
    100,
    "Banyuurip",
    null,
    "city-sby",
    { transactionType: "SEWA", listingCategory: null, rentalPeriod: null },
  ),
);
module.exports = function feed(params) {
  const city =
    params.get("city") === "Kota Surabaya"
      ? "city-sby"
      : params.get("city") || "";
  const filters = {
    ...search.readInvestorSearch(params),
    transactionType: params.get("transaction") || "BELI",
    listingCategory: params.get("category") || "ALL",
    dataState: params.get("data") || "all",
    city,
    query: params.get("q") || "",
    minDrop: Number(params.get("drop") ?? 25),
    minSpread: Number(params.get("spread") ?? 25),
    sort: params.get("sort") || "score",
    savedOnly: params.get("saved") === "1",
    upcomingOnly: params.get("upcoming") === "1",
  };
  const scoped = listings.filter(
    (item) =>
      (filters.locations?.length || !city || item.cityId === city) &&
      search.matchesInvestorSearch(item, filters) &&
      item.transactionType === filters.transactionType,
  );
  const qualified = quant.selectDeals(scoped, {
    ...filters,
    query: "",
    dataState: "deals",
    savedOnly: false,
    sort: "score",
  });
  const filtered = quant.selectDeals(
    scoped,
    filters,
    (params.get("ids") || "").split(","),
  );
  const pageSize =
    params.get("view") === "map" ? 200 : quant.INVESTOR_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(
    Math.max(1, Number(params.get("page") || 1)),
    pageCount,
  );
  const spreads = scoped.flatMap((item) =>
    item.metricMarketSpreadPct === null ? [] : [item.metricMarketSpreadPct],
  );
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    cities,
    locations: [...new Set(scoped.map((item) => item.kelurahanName))],
    total: filtered.length,
    page,
    pageSize,
    pageCount,
    cityId: city,
    generatedAt: "2026-10-22T14:00:00.000Z",
    summary: {
      missingKelurahanCount: scoped.filter((p) => !p.kelurahanVerified).length,
      activeListings: scoped.length,
      matchingListingsCount: quant.selectDeals(
        scoped,
        { ...filters, dataState: "all" },
        (params.get("ids") || "").split(","),
      ).length,
      worthItCount: qualified.length,
      avgMarketSpread:
        spreads.reduce((sum, item) => sum + item, 0) / spreads.length,
      benchmarkCoverage: spreads.length,
      historyCoverage: scoped.filter(
        (item) => item.metricAuctionDropPct !== null,
      ).length,
      unscoredCount: 0,
      pastScheduleCount: 0,
      topDeal: qualified[0] ?? null,
      suggestedDeals: qualified.slice(0, 5),
    },
  };
};

module.exports.proof = function proof(id, options = {}) {
  const listing = listings.find((item) => item.id === id);
  const benchmark = listing.benchmark
    ? {
        ...listing.benchmark,
        propertyType: listing.propertyType,
        scope: "KELURAHAN",
        districtName: listing.districtName,
        sampleCount: options.expanded ? 1 : options.many ? 14 : 4,
        kelurahanSampleCount: options.expanded ? 1 : 4,
      }
    : null;
  const version = "2026-10-22T14:00:00.000Z";
  const peers = benchmark
    ? Array.from({ length: benchmark.sampleCount }, (_, index) => ({
        id: String(1000 + index),
        assetCode: `FIXTURE-${1000 + index}`,
        locationSummary: `Lokasi fixture ${index + 1}, ${listing.kelurahanName}`,
        propertyType: listing.propertyType,
        initialAuctionPrice:
          benchmark.avgPricePerSqm * (0.3 + index * 0.1) * 100,
        landAreaSqm: 100,
        baselinePricePerSqm: benchmark.avgPricePerSqm * (0.3 + index * 0.1),
        listingUrl: `/Lelang/fixture-${1000 + index}`,
        updatedAt: version,
        imageUrl: listing.imageUrl,
        listingCategory: listing.listingCategory,
        transactionType: listing.transactionType,
        rentalPeriod: listing.rentalPeriod,
      }))
    : [];
  const evidence = load("src/lib/investor-roi.ts").selectCmaEvidence(
    peers,
    listing.assetCode,
  );
  if (benchmark)
    benchmark.avgPricePerSqm =
      peers.reduce((sum, peer) => sum + peer.baselinePricePerSqm, 0) /
      peers.length;
  return {
    listing: {
      ...listing,
      identityVerified: true,
      benchmark,
      benchmarkVersion: version,
    },
    benchmark,
    version,
    generatedAt: version,
    kelurahanSampleCount: options.expanded ? 1 : 4,
    expandedToDistrict: false,
    ...evidence,
  };
};

module.exports.correctLocation = (id) => {
  const index = listings.findIndex((p) => p.id === id);
  listings[index] = {
    ...listings[index],
    kelurahanId: "city-sby/Kebraon",
    kelurahanName: "Kebraon",
    kelurahanVerified: true,
  };
};
