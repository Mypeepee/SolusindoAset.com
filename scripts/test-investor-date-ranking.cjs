const assert = require("node:assert/strict");
const { test } = require("node:test");
const createLoader = require("./lib/investor-test-loader.cjs");
const { analyzeListing, selectDeals, INVESTOR_PAGE_SIZE } = createLoader()(
  "src/lib/investor-deals.ts",
);

const now = new Date("2026-11-06T12:00:00Z");
const filters = {
  city: "city-1",
  query: "",
  minSpread: 25,
  minDrop: 25,
  sort: "auctionDate",
  dataState: "all",
  savedOnly: false,
  upcomingOnly: false,
};
function deal(id, auctionDate, market, auction = null) {
  return analyzeListing(
    {
      id,
      title: `Aset uji ${id}`,
      cityId: "city-1",
      kelurahanId: "kel-1",
      kelurahanName: "Kelurahan uji",
      transactionType: "BELI",
      listingCategory: "LELANG",
      propertyType: "RUMAH",
      currentAuctionPrice: 100,
      initialAuctionPrice: auction === null ? null : 100 / (1 - auction / 100),
      landAreaSqm: 1,
      auctionDate,
    },
    market === null
      ? null
      : {
          cityId: "city-1",
          kelurahanId: "kel-1",
          avgPricePerSqm: 100 / (1 - market / 100),
          sampleCount: 1,
        },
  );
}
const rank = (items, patch = {}, savedIds = []) =>
  selectDeals(items, { ...filters, ...patch }, savedIds, now);
const ids = (items) => Array.from(items, (item) => item.id);

test("same-day auctions use combined points even when the highest score has a later time", () => {
  const items = [
    deal("1", "2026-11-09T01:00:00Z", 17, 48.5),
    deal("2", "2026-11-09T08:00:00Z", 76.2, 63.5),
    deal("3", "2026-11-09T00:00:00Z", -28.1),
  ];
  assert.ok(Math.abs(items[1].primaryDealScore - 139.7) < 1e-10);
  assert.ok(Math.abs(items[0].primaryDealScore - 65.5) < 1e-10);
  assert.deepEqual(ids(rank(items)), ["2", "1", "3"]);
  assert.deepEqual(ids(items), ["1", "2", "3"], "Ranking must not mutate input");
});

test("nearest WIB calendar day takes priority over points and includes all of today", () => {
  const items = [
    deal("1", "2026-11-06T17:00:00Z", 90, 90), // 7 November WIB
    deal("2", "2026-11-06T08:00:00Z", 10), // 6 November WIB
    deal("3", "2026-11-05T17:30:00Z", 20), // 6 November WIB, previous UTC day
    deal("4", "2026-11-05T16:59:59Z", 99), // 5 November WIB
    deal("5", "2026-11-06", 15),
    deal("6", "2026-11-06T23:59:59+07:00", 30),
  ];
  assert.deepEqual(ids(rank(items)), ["6", "3", "5", "2", "1", "4"]);
});

test("unknown drivers, zero and signed negative discounts retain their score meaning", () => {
  const date = "2026-11-09T03:00:00Z";
  const items = [
    deal("1", date, null),
    deal("2", date, -28.1),
    deal("3", date, 0, 0),
    deal("4", date, 10),
    deal("5", date, -28.1, 40),
    deal("6", date, null, 15),
    deal("7", date, 5, -10),
  ];
  assert.deepEqual(ids(rank(items)), ["6", "5", "4", "3", "7", "2", "1"]);
});

test("equal points use numeric listing IDs consistently, including IDs above safe integers", () => {
  const items = ["9007199254740993", "10", "9007199254740992", "2"].map(
    (id, index) => deal(id, `2026-11-09T0${index}:00:00Z`, 25, 25),
  );
  const expected = ["2", "10", "9007199254740992", "9007199254740993"];
  assert.deepEqual(ids(rank(items)), expected);
  assert.deepEqual(ids(rank([...items].reverse())), expected);
  assert.deepEqual(
    ids(rank(items.map((item) => deal(item.id, item.auctionDate, null)))),
    expected,
    "All-unknown scores still have a deterministic order",
  );
});

test("past, missing and invalid schedules follow upcoming dates, ordered by known points", () => {
  const items = [
    deal("1", null, 60),
    deal("2", "invalid-date", 90),
    deal("3", "2026-11-05T16:59:59Z", 75),
    deal("4", "2026-11-20T03:00:00Z", -50),
    deal("5", null, null),
  ];
  assert.deepEqual(ids(rank(items)), ["4", "2", "3", "1", "5"]);
  assert.deepEqual(ids(rank(items, { upcomingOnly: true })), ["4"]);
});

test("the full same-day scope is ranked before 30-card pagination", () => {
  const items = Array.from({ length: 65 }, (_, index) =>
    deal(
      String(index + 1),
      new Date(Date.parse("2026-11-09T00:00:00Z") + index * 60_000).toISOString(),
      index,
      10,
    ),
  );
  const ordered = rank(items);
  const expected = Array.from({ length: 65 }, (_, index) => String(65 - index));
  assert.deepEqual(ids(ordered), expected);
  assert.deepEqual(ids(ordered.slice(0, INVESTOR_PAGE_SIZE)), expected.slice(0, 30));
  assert.deepEqual(ids(ordered.slice(INVESTOR_PAGE_SIZE)), expected.slice(30));
});

test("date-and-score ranking still respects saved-only and Worth-it filters", () => {
  const items = [
    deal("1", "2026-11-09T00:00:00Z", 10, 10),
    deal("2", "2026-11-09T08:00:00Z", 40, 40),
    deal("3", "2026-11-10T03:00:00Z", 90, 90),
  ];
  assert.deepEqual(ids(rank(items, { savedOnly: true }, ["1", "2"])), ["2", "1"]);
  assert.deepEqual(ids(rank(items, { dataState: "deals" })), ["2", "3"]);
});

test("Paling worth-it continues to rank points globally regardless of auction day", () => {
  const items = [
    deal("1", "2026-11-06T08:00:00Z", 10),
    deal("2", "2026-11-09T03:00:00Z", 60, 60),
  ];
  assert.deepEqual(ids(rank(items)), ["1", "2"]);
  assert.deepEqual(ids(rank(items, { sort: "score" })), ["2", "1"]);
});
