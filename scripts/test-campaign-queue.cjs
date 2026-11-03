const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const createLoader = require("./lib/marketing-test-loader.cjs");
const domain = createLoader()("src/lib/marketing/domain.ts");
const now = new Date("2026-11-01T00:00:00+07:00");
const brief = {
  name: "Campaign Surabaya",
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  schedules: ["08:00", "12:00"],
  listingIds: [],
  assetOrder: "fresh",
  channels: ["instagram"],
  city: "Kota Surabaya",
  locations: [],
  category: "ALL",
  propertyTypes: [],
  minPrice: null,
  maxPrice: null,
  discountMode: "auction",
  minDrop: 50,
};
const listing = {
  id: "123",
  assetCode: "parcel-123",
  title: "Rumah",
  address: "Surabaya",
  cityName: "Kota Surabaya",
  kelurahanId: "kel-1",
  kelurahanName: "Lokasi terverifikasi",
  currentAuctionPrice: 400e6,
  landAreaSqm: 100,
  metricAuctionDropPct: 60,
  metricMarketSpreadPct: 40,
  transactionType: "BELI",
  listingCategory: "LELANG",
  propertyType: "RUMAH",
  status: "TERSEDIA",
  auctionDate: "2026-11-20T00:00:00+07:00",
  imageUrls: ["https://example.test/property.jpg"],
  listingUrl: "/Lelang/123",
  sourceRevision: "one",
};

function setup({ state = "draft", source = [listing], fail = false } = {}) {
  const id = randomUUID();
  const row = {
    id,
    state,
    revision: 3,
    brief: structuredClone(brief),
    activeBrief: state === "draft" ? {} : structuredClone(brief),
    evaluation: {},
  };
  const jobs = [];
  const reads = [];
  const server = createLoader({
    "@/lib/prisma": {
      marketingCampaign: { findUnique: async () => row },
      marketingJob: { findMany: async () => jobs },
    },
    "@/lib/investor-read.server": {
      withInvestorRead: async (read) => read({}),
    },
    "@/lib/investor-cma-legacy.server": {
      getMarketingInvestorCandidates: async (_, filters, excluded, offset) => {
        reads.push(filters);
        if (fail) throw new Error("Source unavailable");
        return { items: source.slice(offset), total: source.length };
      },
      getMarketingInvestorScope: async () => source,
    },
    "./store.server": {
      getSettings: async () => ({ config: domain.DEFAULT_CONFIG }),
    },
    "./campaign-dedup.server": {
      marketedAssetKeys: async () => new Set(),
      reservedAssetKeys: async () => new Set(),
    },
    "./service.server": {},
    "./media.server": {},
    "./security.server": {},
  })("src/lib/marketing/campaigns.server.ts");
  return { server, row, jobs, reads };
}

test("draft queue checks real stock without creating assignments or applying the draft", async () => {
  const { server, row, jobs } = setup();
  const before = structuredClone(row);
  const queue = await server.getCampaignQueue(row.id, now);
  assert.equal(queue.active, false);
  assert.equal(queue.inventory.eligible, 1);
  assert.equal(queue.inventory.diagnostics.ready, 1);
  assert.equal(queue.inventory.upcomingSlots, 4);
  assert.equal(queue.checkedAt, now.toISOString());
  assert.ok(
    queue.days.flatMap((day) => day.slots).every((slot) => !slot.asset),
  );
  assert.deepEqual(row, before);
  assert.deepEqual(jobs, []);
});

test("empty draft queue explains expired auctions and missing evidence from the original source", async () => {
  const { server, row } = setup({
    source: [
      { ...listing, auctionDate: "2026-06-28T17:00:00Z" },
      {
        ...listing,
        id: "124",
        assetCode: "parcel-124",
        listingCategory: "SECONDARY",
        auctionDate: null,
        metricAuctionDropPct: null,
      },
    ],
  });
  const queue = await server.getCampaignQueue(row.id, now);
  assert.equal(queue.inventory.eligible, 0);
  assert.equal(queue.inventory.diagnostics.total, 2);
  assert.equal(queue.inventory.diagnostics.expired, 1);
  assert.equal(queue.inventory.diagnostics.missingEvidence, 1);
  assert.equal(
    queue.inventory.diagnostics.latestAuctionDate,
    "2026-06-28T17:00:00.000Z",
  );
  assert.equal(queue.inventoryError, false);
});

test("active queue diagnosis uses approved criteria and preserves assigned property facts", async () => {
  const { server, row, jobs, reads } = setup({ state: "running" });
  row.brief.city = "Kabupaten Sidoarjo";
  row.brief.name = "Unapplied edit";
  const snapshot = domain.snapshotAsset(listing);
  jobs.push({
    campaignId: row.id,
    scheduledFor: new Date("2026-11-01T08:00:00+07:00"),
    snapshot,
    status: "queued",
    reason: null,
    assetKey: snapshot.assetKey,
    publications: [],
  });
  const before = structuredClone(jobs);
  const queue = await server.getCampaignQueue(row.id, now);
  assert.equal(queue.campaignName, brief.name);
  assert.equal(reads[0].city, brief.city);
  assert.deepEqual(queue.days[0].slots[0].asset, snapshot);
  assert.deepEqual(jobs, before);
});

test("source failure keeps persisted assignments and reports an unchecked inventory", async (t) => {
  t.mock.method(console, "error", () => {});
  const { server, row, jobs } = setup({ state: "running", fail: true });
  const snapshot = domain.snapshotAsset(listing);
  jobs.push({
    campaignId: row.id,
    scheduledFor: new Date("2026-11-01T08:00:00+07:00"),
    snapshot,
    status: "queued",
    reason: null,
    assetKey: snapshot.assetKey,
    publications: [],
  });
  const queue = await server.getCampaignQueue(row.id, now);
  assert.equal(queue.inventory, null);
  assert.equal(queue.inventoryError, true);
  assert.deepEqual(queue.days[0].slots[0].asset, snapshot);
});

test("ended queues do not inspect current stock or invent future sessions", async () => {
  const { server, row, reads } = setup();
  const queue = await server.getCampaignQueue(
    row.id,
    new Date("2026-11-06T00:00:00+07:00"),
  );
  assert.equal(queue.inventory, null);
  assert.deepEqual(queue.days, []);
  assert.deepEqual(reads, []);
});
