const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const createLoader = require("./lib/marketing-test-loader.cjs");
const load = createLoader({
  "@/lib/prisma": {},
  "@/lib/chatbot/server-access": {
    resolveChatbotOwner: async () => ({ status: 200 }),
  },
});
const d = load("src/lib/marketing/domain.ts");
const c = load("src/lib/marketing/campaign.ts");
const plan = load("src/lib/marketing/plan.ts");
const planner = load("src/lib/marketing/planner.ts");
const security = load("src/lib/marketing/security.server.ts");
const selection = load("src/lib/marketing/campaign-selection.ts");
const simulation = load("src/lib/marketing/campaign-simulation.ts");
const archiveHelpers = load("src/lib/marketing/campaign-archive.ts");
const timeInput = load("src/lib/marketing/campaign-time-input.ts");

test("campaign time entry formats four digits and rejects impossible or pasted junk times", () => {
  for (const [raw, expected] of [
    ["1200", "12:00"],
    ["0000", "00:00"],
    ["2359", "23:59"],
    ["09:30", "09:30"],
  ]) {
    assert.equal(timeInput.campaignTimeInput(raw), expected);
    assert.equal(timeInput.completeCampaignTime(raw), expected);
  }
  for (const raw of [
    "2400",
    "2500",
    "1260",
    "23:99",
    "12:000",
    "12000",
    "12::00",
    "12am",
    "ab1200",
    "-1:00",
  ]) {
    assert.equal(timeInput.campaignTimeInput(raw), null, raw);
    assert.equal(timeInput.completeCampaignTime(raw), null, raw);
  }
  for (const raw of ["", "1", "12", "12:", "12:0", "23:6", "09:9"]) {
    assert.notEqual(
      timeInput.campaignTimeInput(raw),
      null,
      "partial drafts remain editable",
    );
    assert.equal(
      timeInput.completeCampaignTime(raw),
      null,
      "partial drafts cannot become a stored time",
    );
    assert.equal(
      d.settingsSchema.shape.schedules.safeParse([raw]).success,
      false,
    );
  }
  assert.equal(timeInput.completeCampaignTime("9:30"), "09:30");
});

test("all 1440 valid times survive numeric typing and backend validation", () => {
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute++) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      let draft = "";
      for (const digit of value.replace(":", ""))
        draft = timeInput.campaignTimeInput(draft + digit);
      assert.equal(draft, value);
      assert.equal(timeInput.completeCampaignTime(draft), value);
      assert.equal(
        d.settingsSchema.shape.schedules.safeParse([value]).success,
        true,
      );
    }
  }
});

test("campaign times must increase at every slot, and invalid order clears the Planner projection", () => {
  for (const schedules of [
    ["12:30", "15:30", "13:40"],
    ["13:00", "17:00", "14:00"],
    ["09:00", "09:00"],
    ["23:59", "00:00"],
  ]) {
    const draft = { ...simulation.simulationBrief("2026-11-01"), schedules };
    const parsed = c.campaignBriefSchema.safeParse(draft);
    assert.equal(parsed.success, false);
    assert.ok(
      parsed.error.issues.some(
        (issue) =>
          issue.path[0] === "schedules" && /lebih akhir/.test(issue.message),
      ),
    );
    const projection = simulation.projectSimulation(draft);
    assert.equal(projection.jobs.length, 0);
    assert.match(projection.errors.schedules, /lebih akhir/);
    assert.deepEqual(
      draft.schedules,
      schedules,
      "validation never silently reorders user edits",
    );
  }
  assert.equal(
    c.campaignBriefSchema.safeParse({
      ...brief(),
      schedules: ["00:00", "00:01", "23:59"],
    }).success,
    true,
  );
  const legacy = { ...brief(), schedules: ["12:30", "15:30", "13:40"] };
  assert.deepEqual(
    c.storedCampaignBrief(legacy).schedules,
    legacy.schedules,
    "historical reads retain their original data",
  );
  assert.equal(
    c.storedCampaignBriefSchema.safeParse(legacy).success,
    true,
    "active historical periods must remain reserved",
  );
});

test("adding up to twelve slots always preserves increasing hours, including midnight and restored edits", () => {
  const original = ["09:00", "13:00", "18:45"];
  const reduced = timeInput.resizeCampaignTimes(original, 2);
  assert.deepEqual(
    timeInput.resizeCampaignTimes(reduced, 3, original),
    original,
  );
  assert.deepEqual(original, ["09:00", "13:00", "18:45"]);
  for (let minute = 0; minute < 1440; minute++) {
    const first = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const times = timeInput.resizeCampaignTimes([first], 12);
    assert.equal(times.length, 12);
    assert.equal(new Set(times).size, 12);
    assert.ok(times.includes(first), "existing edited time is retained");
    assert.equal(timeInput.campaignTimeOrderIssue(times), null);
    assert.ok(
      times.every((time) => timeInput.completeCampaignTime(time) === time),
    );
  }
  for (const invalid of [["12:"], ["15:30", "13:40"]]) {
    assert.deepEqual(
      timeInput.resizeCampaignTimes(invalid, invalid.length + 1),
      invalid,
      "finish invalid edits before adding more slots",
    );
  }
});

test("example campaign projects A, B, C into the same Planner schedule in WIB", () => {
  const brief = simulation.simulationBrief("2026-10-31");
  const result = simulation.projectSimulation(brief);
  assert.equal(Object.keys(result.errors).length, 0);
  assert.deepEqual(
    Array.from(result.jobs, (job) => job.snapshot.title),
    ["Aset A", "Aset B", "Aset C"],
  );
  assert.deepEqual(
    Array.from(result.jobs, (job) => job.scheduledFor.toISOString()),
    [
      "2026-10-31T02:00:00.000Z",
      "2026-10-31T06:00:00.000Z",
      "2026-10-31T11:00:00.000Z",
    ],
  );
  const slots = planner
    .plannerSlots(result.config, result.jobs, "2026-10", result.now, [
      { startDate: brief.startDate, endDate: brief.endDate },
    ])
    .filter((slot) => slot.job);
  assert.deepEqual(
    Array.from(slots, (slot) => slot.job.listingId),
    Array.from(brief.listingIds),
  );
  assert.ok(
    result.jobs.every(
      (job) =>
        planner.slotState(job, result.now) === "ready" && c.campaignPlan(job),
    ),
  );
  assert.ok(result.jobs.every((job) => job.publications.length === 0));
  assert.equal(result.config.enabled, false);
});

test("example intensity and edited hours immediately change the Planner projection", () => {
  const brief = simulation.simulationBrief("2026-10-31");
  brief.schedules = ["11:05", "16:15"];
  let result = simulation.projectSimulation(brief);
  assert.equal(result.jobs.length, 2);
  assert.equal(
    result.jobs[0].scheduledFor.toISOString(),
    "2026-10-31T04:05:00.000Z",
  );
  brief.schedules = ["09:00", "13:00", "18:00", "19:00"];
  result = simulation.projectSimulation(brief);
  assert.equal(result.jobs.length, 4);
  assert.equal(result.jobs.filter((job) => job.listingId).length, 3);
  assert.equal(result.jobs[3].reason, "CAMPAIGN_NO_ELIGIBLE_ASSET");
  brief.schedules = ["09:00", "09:00"];
  result = simulation.projectSimulation(brief);
  assert.ok(result.errors.schedules);
  assert.equal(
    result.jobs.length,
    0,
    "invalid input must not leave an old plan on screen",
  );
});

test("example stock follows real expiry, images, freshness and parcel cooldown", () => {
  const brief = simulation.simulationBrief("2026-10-31");
  brief.endDate = "2026-11-08";
  const assets = simulation.simulationAssets(brief.startDate);
  let result = simulation.projectSimulation(brief, assets);
  assert.equal(result.jobs.filter((job) => job.listingId).length, 4);
  assert.equal(
    result.jobs.filter((job) => job.listingId)[3].scheduledFor.toISOString(),
    "2026-11-08T02:00:00.000Z",
  );
  assets[0].auctionDate = "2026-10-31T08:00:00Z";
  assets[1].images = [];
  result = simulation.projectSimulation(
    { ...brief, endDate: brief.startDate },
    assets,
  );
  assert.equal(result.jobs.filter((job) => job.listingId).length, 1);
  assert.equal(result.jobs[0].snapshot.title, "Aset C");
});
const { diagnoseCampaignInventory } = load(
  "src/lib/marketing/campaign-inventory.ts",
);
const { BUY_PROPERTY_TYPES } = load("src/lib/propertyType.ts");
const brief = (extra = {}) => ({
  name: "Campaign Surabaya",
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  schedules: ["08:15", "17:45"],
  listingIds: ["1", "2"],
  channels: ["instagram"],
  city: "",
  locations: [{ id: "3578", name: "Kota Surabaya", level: "kota" }],
  category: "ALL",
  propertyTypes: ["RUMAH"],
  minPrice: null,
  maxPrice: 1e9,
  ...extra,
});
const listing = (extra = {}) => ({
  id: "1",
  assetCode: "parcel-1",
  title: "Rumah",
  cityName: "Kota Surabaya",
  kelurahanId: "kel-1",
  kelurahanName: "Contoh",
  districtName: "Contoh",
  address: "Jalan Contoh",
  currentAuctionPrice: 400e6,
  landAreaSqm: 100,
  metricAuctionDropPct: null,
  metricMarketSpreadPct: 40,
  transactionType: "BELI",
  listingCategory: "SECONDARY",
  propertyType: "RUMAH",
  status: "TERSEDIA",
  auctionDate: null,
  imageUrls: ["https://example.test/photo.jpg"],
  listingUrl: "/Jual/rumah-1",
  sourceRevision: "one",
  ...extra,
});
const campaignPlan = (extra = {}) => ({
  kind: "campaign",
  campaignId: randomUUID(),
  proposalId: randomUUID(),
  campaignName: "Campaign Surabaya",
  listingId: "1",
  channels: ["instagram"],
  criteria: c.campaignCriteria(brief()),
  ...extra,
});

test("inventory diagnosis counts disjoint source reasons before pagination", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  const config = {
    ...d.DEFAULT_CONFIG,
    minDrop: 50,
    minSpread: 25,
    discountMode: "auction",
  };
  const auction = (extra) =>
    listing({
      listingCategory: "LELANG",
      auctionDate: "2026-11-10T00:00:00Z",
      metricAuctionDropPct: 60,
      ...extra,
    });
  const source = [
    auction({ auctionDate: "2026-07-02T17:00:00Z" }),
    auction({
      auctionDate: new Date(now.getTime() + 24 * 3600000).toISOString(),
    }),
    auction({ auctionDate: null }),
    auction({ kelurahanId: null }),
    auction({ metricAuctionDropPct: null }),
    auction({ metricAuctionDropPct: 49.99 }),
    auction({ status: "TERJUAL" }),
    auction({ imageUrls: [] }),
    auction({}),
  ];
  const stats = diagnoseCampaignInventory(source, config, 1, now);
  assert.equal(stats.total, 9);
  for (const key of [
    "ready",
    "expired",
    "closingSoon",
    "missingAuctionDate",
    "unverified",
    "missingEvidence",
    "belowThreshold",
    "unavailable",
    "missingPhotos",
  ])
    assert.equal(stats[key], 1, key);
  assert.equal(stats.latestAuctionDate, "2026-11-10T00:00:00.000Z");
});
test("expired auctions stay excluded regardless of percent thresholds and never look like missing source stock", () => {
  const config = { ...d.DEFAULT_CONFIG, minDrop: 0, minSpread: 0 };
  const expired = Array.from({ length: 1545 }, (_, i) =>
    listing({
      id: String(i + 1),
      listingCategory: "LELANG",
      auctionDate: "2026-07-02T17:00:00Z",
    }),
  );
  const stats = diagnoseCampaignInventory(
    expired,
    config,
    0,
    new Date("2026-10-31T12:00:00Z"),
  );
  assert.equal(stats.total, 1545);
  assert.equal(stats.expired, 1545);
  assert.equal(stats.ready, 0);
  assert.equal(stats.belowThreshold, 0);
});

test("previously marketed properties are explained separately from missing photographs", () => {
  const stats = diagnoseCampaignInventory(
    [listing({}), listing({ id: "2", imageUrls: [] })],
    { ...d.DEFAULT_CONFIG, minSpread: 25, discountMode: "market" },
    0,
    new Date("2026-11-01T00:00:00+07:00"),
    1,
  );
  assert.equal(stats.alreadyMarketed, 1);
  assert.equal(stats.missingPhotos, 1);
});

test("campaign accepts every Home sale/auction type and rejects rental-only Kos", () => {
  assert.equal(
    c.campaignBriefSchema.safeParse({
      ...brief(),
      propertyTypes: [...BUY_PROPERTY_TYPES],
    }).success,
    true,
  );
  for (const propertyType of ["GUDANG", "PABRIK", "TOKO", "HOTEL_DAN_VILLA"]) {
    assert.equal(
      c.campaignBriefSchema.safeParse({
        ...brief(),
        propertyTypes: [propertyType],
      }).success,
      true,
    );
    assert.equal(
      d.investorFilters({ ...d.DEFAULT_CONFIG, propertyTypes: [propertyType] })
        .propertyTypes[0],
      propertyType,
    );
  }
  assert.equal(
    c.campaignBriefSchema.safeParse({ ...brief(), propertyTypes: ["KOS"] })
      .success,
    false,
  );
});

test("fresh campaign ranking uses source listing dates and retains stable order for unknown dates", () => {
  const assets = [
    d.snapshotAsset(listing({ id: "1" })),
    d.snapshotAsset(
      listing({ id: "2", sourceListedAt: "2026-10-20T00:00:00Z" }),
    ),
    d.snapshotAsset(
      listing({ id: "3", sourceListedAt: "2026-10-29T00:00:00Z" }),
    ),
    d.snapshotAsset(listing({ id: "4", sourceListedAt: "invalid" })),
  ];
  assert.deepEqual(
    selection.freshAssetOrder(assets).map((a) => a.id),
    ["3", "2", "1", "4"],
  );
  assert.equal(
    selection.assetFreshnessLabel(assets[3]),
    "Tanggal masuk belum tersedia",
  );
  assert.equal(c.storedCampaignBrief(brief()).assetOrder, "manual");
  assert.equal(
    c.storedCampaignBrief({ ...brief(), listingIds: [] }).assetOrder,
    "fresh",
  );
});

test("campaign auctions require at least five complete days before the auction, including missing dates and photos", () => {
  const when = new Date("2026-11-01T02:00:00Z");
  const asset = d.snapshotAsset(
    listing({
      listingCategory: "LELANG",
      auctionDate: "2026-11-06T01:59:59.999Z",
    }),
  );
  assert.equal(selection.campaignAssetAvailable(asset, when), false);
  assert.equal(
    selection.campaignAssetAvailable(
      { ...asset, auctionDate: "2026-11-06T02:00:00.000Z" },
      when,
    ),
    true,
  );
  assert.equal(
    selection.campaignAssetAvailable({ ...asset, auctionDate: null }, when),
    false,
  );
  assert.equal(
    selection.campaignAssetAvailable(
      { ...asset, category: "SECONDARY", auctionDate: null },
      when,
    ),
    true,
  );
  assert.equal(
    selection.campaignAssetAvailable(
      { ...asset, category: "SECONDARY", images: [] },
      when,
    ),
    false,
  );
});

test("fresh selection balances rotation and respects reservations, conflicts, and parcel identity", () => {
  const dates = [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-10",
  ].map((v) => new Date(v + "T02:00:00Z"));
  const assets = [
    d.snapshotAsset(
      listing({ id: "1", assetCode: "same", sourceListedAt: "2026-10-29" }),
    ),
    d.snapshotAsset(
      listing({ id: "2", assetCode: "other", sourceListedAt: "2026-10-20" }),
    ),
    d.snapshotAsset(
      listing({ id: "3", assetCode: "same", sourceListedAt: "2026-10-28" }),
    ),
  ];
  const slots = selection.selectCampaignAssets(
    assets,
    dates,
    7,
    () => new Set(),
    (when) => when === dates[2],
  );
  assert.deepEqual(
    slots.map((s) => s.asset?.id || s.reason),
    ["1", "2", "CAMPAIGN_SLOT_CONFLICT", "CAMPAIGN_NO_ELIGIBLE_ASSET", "1"],
  );
  assert.equal(
    selection.selectCampaignAssets(
      assets,
      [dates[0]],
      7,
      () => new Set(["asset:same", "asset:other"]),
      () => false,
    )[0].asset,
    null,
  );
});

test("recommendation cannot schedule an auction after its safe deadline and uses surviving stock", () => {
  const dates = [
    new Date("2026-11-01T02:00:00Z"),
    new Date("2026-11-03T02:00:00Z"),
  ];
  const auction = d.snapshotAsset(
    listing({
      listingCategory: "LELANG",
      auctionDate: "2026-11-06T02:00:00Z",
      sourceListedAt: "2026-10-29",
    }),
  );
  const other = d.snapshotAsset(listing({ id: "2", assetCode: "other" }));
  const slots = selection.selectCampaignAssets(
    [auction, other],
    dates,
    1,
    () => new Set(),
    () => false,
  );
  assert.deepEqual(
    slots.map((s) => s.asset.id),
    ["1", "2"],
  );
});

test("Planner marks an expiring campaign asset for review and omits replaced revision history", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  const job = {
    id: "one",
    plan: campaignPlan(),
    scheduledFor: "2026-11-01T02:00:00Z",
    status: "queued",
    listingId: "1",
    snapshot: d.snapshotAsset(
      listing({
        listingCategory: "LELANG",
        auctionDate: "2026-11-02T02:00:00Z",
      }),
    ),
    publications: [],
  };
  assert.equal(planner.slotState(job, now), "review");
  const slots = planner.plannerSlots(
    d.DEFAULT_CONFIG,
    [{ ...job, reason: "CAMPAIGN_REPLACED" }],
    "2026-11",
    now,
    [{ startDate: "2026-11-01", endDate: "2026-11-30" }],
  );
  assert.equal(slots.length, 0);
});

test("campaign form validates calendar dates, duration, price range, and channel uniqueness", () => {
  assert.equal(c.campaignBriefSchema.safeParse(brief()).success, true);
  for (const change of [
    { startDate: "2026-11-31" },
    { endDate: "2026-10-01" },
    { endDate: "2027-03-01" },
    { minPrice: 2e9, maxPrice: 1e9 },
    { channels: [] },
    { channels: ["instagram", "instagram"] },
  ])
    assert.equal(
      c.campaignBriefSchema.safeParse({ ...brief(), ...change }).success,
      false,
      JSON.stringify(change),
    );
});
test("legacy campaigns inherit global discount thresholds and retain automation safety controls", () => {
  const global = {
    ...d.DEFAULT_CONFIG,
    city: "Sidoarjo",
    maxPrice: 200e6,
    minSpread: 30,
    minDrop: 35,
    cooldownDays: 14,
  };
  const config = c.campaignConfig(global, brief());
  assert.deepEqual(config.locations, brief().locations);
  assert.equal(config.maxPrice, 1e9);
  assert.equal(config.city, "");
  assert.equal(config.minSpread, 30);
  assert.equal(config.minDrop, 35);
  assert.equal(config.cooldownDays, 14);
  assert.equal(config.enabled, false);
  assert.equal(config.discountMode, "either");
  const legacy = c.storedCampaignBrief(brief());
  assert.equal(legacy.minSpread, undefined);
  assert.equal(legacy.discountMode, undefined);
  assert.equal(
    JSON.stringify(c.campaignCriteria(legacy)),
    JSON.stringify(c.campaignCriteria(brief())),
  );
});
test("campaign percent filters validate, persist in briefs and survive approved Planner criteria", () => {
  const raw = {
    ...brief(),
    minSpread: 32.5,
    minDrop: 60,
    discountMode: "auction",
  };
  const saved = c.storedCampaignBrief(JSON.parse(JSON.stringify(raw)));
  const criteria = c.campaignCriteria(saved);
  assert.equal(criteria.minSpread, 32.5);
  assert.equal(criteria.minDrop, 60);
  assert.equal(criteria.discountMode, "auction");
  assert.deepEqual(
    c.campaignPlan({ plan: campaignPlan({ criteria }) }).criteria,
    criteria,
  );
  for (const change of [
    { minSpread: -1 },
    { minSpread: 101 },
    { minDrop: NaN },
    { minDrop: Infinity },
    { minDrop: null },
    { discountMode: "both" },
  ]) {
    assert.equal(
      c.campaignBriefSchema.safeParse({ ...raw, ...change }).success,
      false,
    );
    assert.equal(
      c.campaignInventorySchema.safeParse({
        criteria: { ...criteria, ...change },
        startDate: raw.startDate,
        endDate: raw.endDate,
        listingIds: [],
      }).success,
      false,
    );
  }
  assert.equal(
    c.campaignBriefSchema.safeParse({ ...raw, minSpread: 0, minDrop: 100 })
      .success,
    true,
  );
});
test("campaign discount rules apply before inventory pagination and in worker eligibility", () => {
  const investor = load("src/lib/investor-deals.ts");
  const source = [
    listing({ id: "1", metricMarketSpreadPct: 30, metricAuctionDropPct: 5 }),
    listing({ id: "2", metricMarketSpreadPct: 5, metricAuctionDropPct: 50 }),
    listing({
      id: "3",
      metricMarketSpreadPct: null,
      metricAuctionDropPct: null,
    }),
    listing({
      id: "4",
      metricMarketSpreadPct: 29.9,
      metricAuctionDropPct: 49.9,
    }),
  ];
  const global = {
    ...d.DEFAULT_CONFIG,
    minSpread: 99,
    minDrop: 99,
    cooldownDays: 14,
  };
  for (const [discountMode, expected] of [
    ["either", ["1", "2"]],
    ["market", ["1"]],
    ["auction", ["2"]],
  ]) {
    const config = c.campaignConfig(global, {
      ...c.campaignCriteria(brief()),
      locations: [],
      minSpread: 30,
      minDrop: 50,
      discountMode,
    });
    const filters = d.investorFilters(config);
    assert.equal(filters.discountMode, discountMode);
    assert.equal(config.enabled, false);
    assert.equal(config.cooldownDays, 14);
    assert.deepEqual(
      investor
        .selectDeals(source, filters)
        .map((x) => x.id)
        .sort(),
      expected,
    );
    assert.deepEqual(
      source.filter((x) => d.eligibleAsset(x, config)).map((x) => x.id),
      expected,
    );
  }
  assert.equal(
    global.minSpread,
    99,
    "campaign thresholds never mutate global settings",
  );
});
test("missing or negative discount evidence never passes even at a zero threshold", () => {
  for (const discountMode of ["either", "market", "auction"]) {
    const config = c.campaignConfig(d.DEFAULT_CONFIG, {
      ...c.campaignCriteria(brief()),
      minSpread: 0,
      minDrop: 0,
      discountMode,
    });
    for (const value of [null, undefined, NaN, -1])
      assert.equal(
        d.eligibleAsset(
          listing({
            metricMarketSpreadPct: value,
            metricAuctionDropPct: value,
          }),
          config,
        ),
        false,
      );
    assert.equal(
      d.eligibleAsset(
        listing({ metricMarketSpreadPct: 0, metricAuctionDropPct: 0 }),
        config,
      ),
      true,
    );
  }
  const asset = d.snapshotAsset(
    listing({ metricMarketSpreadPct: 32.5, metricAuctionDropPct: null }),
  );
  assert.equal(asset.marketSpreadPct, 32.5);
  assert.equal(asset.auctionDropPct, null);
  assert.equal(
    d.snapshotAsset(listing({ metricMarketSpreadPct: undefined }))
      .marketSpreadPct,
    null,
  );
});
test("daily schedule uses campaign times in WIB, spans every day and omits elapsed times", () => {
  const now = new Date("2026-11-01T01:30:00Z");
  const times = c.campaignSchedule({ ...brief(), endDate: "2026-11-03" }, now);
  assert.equal(times.length, 5);
  assert.deepEqual(
    times.map((t) => t.toISOString()),
    [
      "2026-11-01T10:45:00.000Z",
      "2026-11-02T01:15:00.000Z",
      "2026-11-02T10:45:00.000Z",
      "2026-11-03T01:15:00.000Z",
      "2026-11-03T10:45:00.000Z",
    ],
  );
});
test("campaign rejects duplicate assets, duplicate hours, malformed times and obsolete AI fields", () => {
  for (const change of [
    { listingIds: ["1", "1"] },
    { schedules: ["09:00", "09:00"] },
    { schedules: ["25:00"] },
    { schedules: [] },
    { objective: "strategi" },
    { targetPosts: 3 },
  ])
    assert.equal(
      c.campaignBriefSchema.safeParse({ ...brief(), ...change }).success,
      false,
    );
});
test("legacy campaigns preserve history while obsolete strategy fields are removed", () => {
  const b = brief();
  delete b.schedules;
  delete b.listingIds;
  const read = c.storedCampaignBrief({
    ...b,
    objective: "old",
    focus: "old",
    targetPosts: 10,
  });
  assert.deepEqual(read.listingIds, []);
  assert.deepEqual(read.schedules, d.DEFAULT_CONFIG.schedules);
  assert.equal("focus" in read, false);
});
test("approved campaign periods suppress projected global hours without hiding explicit jobs", () => {
  const base = { ...d.DEFAULT_CONFIG, schedules: ["09:00", "13:00"] },
    time = new Date("2026-11-02T01:15:00Z");
  const result = planner.plannerSlots(
    base,
    [
      {
        id: "job",
        plan: campaignPlan(),
        scheduledFor: time.toISOString(),
        status: "paused",
        listingId: null,
        publications: [],
      },
    ],
    "2026-11",
    new Date("2026-10-28"),
    [{ startDate: "2026-11-01", endDate: "2026-11-03" }],
  );
  assert.equal(result.filter((s) => s.date === "2026-11-02").length, 1);
  assert.equal(result.find((s) => s.date === "2026-11-02").job.id, "job");
});
test("campaign channels and immutable ownership survive Planner parsing", () => {
  const p = campaignPlan(),
    job = { plan: p, status: "queued", listingId: null, publications: [] };
  assert.deepEqual(plan.planChannels(job, d.DEFAULT_CONFIG), ["instagram"]);
  assert.equal(plan.editablePlan(job), false);
  assert.equal(planner.slotState(job), "planned");
  assert.equal(
    c.campaignPlan({ plan: { ...p, listingId: null } }).listingId,
    null,
  );
});
test("snapshot comparison ignores JSONB key order while detecting changed facts", () => {
  const asset = d.snapshotAsset(listing());
  const reordered = Object.fromEntries(Object.entries(asset).reverse());
  assert.equal(c.sameCampaignAsset(asset, reordered), true);
  assert.equal(
    c.sameCampaignAsset(asset, { ...reordered, price: 450e6 }),
    false,
  );
});
test("campaign caption uses FOMO and agent contact without duplicating poster facts", () => {
  const asset = d.snapshotAsset(
    listing({
      listingCategory: "LELANG",
      auctionDate: "2026-12-20T01:00:00Z",
      agentName: "Agent Contoh",
      agentPhone: "081234567891",
    }),
  );
  const text = c.campaignCaption(asset, d.DEFAULT_CONFIG);
  assert.equal(text, d.captionFor(asset, d.DEFAULT_CONFIG));
  assert.match(text, /Hari lelang makin dekat/);
  assert.match(text, /Agent: Agent Contoh/);
  assert.match(text, /WhatsApp: \+6281234567891/);
  assert.doesNotMatch(
    text,
    /Jalan Contoh|400\.000\.000|Penjualan melalui lelang/,
  );
});
test("campaign API explains server outages with a useful error code", () => {
  assert.match(c.campaignErrors.SERVICE_UNAVAILABLE, /kendala/i);
  assert.match(c.campaignErrors.SERVICE_UNAVAILABLE, /SERVICE_UNAVAILABLE/);
});
test("campaign lifecycle labels respect WIB, period boundaries, and paused state", () => {
  const campaign = { brief: brief(), state: "running" };
  assert.equal(
    c.campaignStatus(campaign, new Date("2026-10-31T16:59:00Z")),
    "Terjadwal",
  );
  assert.equal(
    c.campaignStatus(campaign, new Date("2026-10-31T17:00:00Z")),
    "Aktif",
  );
  assert.equal(
    c.campaignStatus(
      { ...campaign, state: "paused" },
      new Date("2026-11-10T00:00:00Z"),
    ),
    "Dijeda",
  );
  assert.equal(
    c.campaignStatus(campaign, new Date("2026-11-30T17:00:00Z")),
    "Berakhir",
  );
});
test("reserved assets include paused campaigns and actual delivery timestamps", () => {
  const server = createLoader({
    "@/lib/prisma": {},
    "@/lib/investor-read.server": {},
    "@/lib/investor-cma-legacy.server": {},
    "./store.server": {},
    "./service.server": {},
    "./media.server": {},
    "./security.server": security,
  })("src/lib/marketing/campaigns.server.ts");
  const when = new Date("2026-11-15T02:00:00Z");
  const rows = [
    {
      assetKey: "paused",
      scheduledFor: when,
      status: "paused",
      publications: [],
    },
    {
      assetKey: "sent",
      scheduledFor: new Date("2026-10-01"),
      status: "completed",
      publications: [
        { state: "published", publishedAt: new Date("2026-11-14") },
      ],
    },
    {
      assetKey: "replaced",
      scheduledFor: when,
      status: "skipped",
      publications: [],
    },
  ];
  assert.deepEqual([...server.reservedAt(rows, when, 7)].sort(), [
    "paused",
    "sent",
  ]);
});

function workerHarness() {
  let asset = listing(),
    job;
  const config = {
    ...d.DEFAULT_CONFIG,
    revision: 9,
    city: "Sidoarjo",
    companyPhone: "6281234567890",
  };
  const cp = campaignPlan();
  const state = {
    campaignState: "running",
    brief: brief({
      startDate: d.jakartaDate(new Date(Date.now() - 86400000)),
      endDate: d.jakartaDate(new Date(Date.now() + 30 * 86400000)),
    }),
    activeBrief: null,
    publications: [],
    render: 0,
    writes: 0,
    filters: null,
  };
  job = {
    id: randomUUID(),
    campaignId: cp.campaignId,
    scheduledFor: new Date(Date.now() + 3600000),
    status: "queued",
    plan: cp,
    listingId: null,
    assetKey: "asset:parcel-1",
    snapshot: d.snapshotAsset(asset),
    caption: "PESAN YANG SUDAH DISETUJUI",
    media: [],
    settingsRevision: 1,
  };
  const db = {
    marketingCampaign: {
      findUnique: async () => ({
        state: state.campaignState,
        brief: state.brief,
        activeBrief: state.activeBrief,
      }),
    },
    marketingJob: {
      findMany: async () => [],
      update: async ({ data }) => (job = { ...job, ...data }),
    },
    marketingPublication: {
      findMany: async () => state.publications,
      updateMany: async () => {
        state.writes++;
        return { count: 0 };
      },
    },
    listing: {
      findUnique: async () => ({
        status_tayang: asset.status,
        bukan_properti: false,
        jenis_transaksi: asset.listingCategory,
        harga: asset.currentAuctionPrice,
        harga_promo: null,
        nilai_limit_lelang: null,
        tanggal_lelang: null,
        gambar: asset.imageUrls.join(","),
        alamat_lengkap: asset.address,
        luas_tanah: asset.landAreaSqm,
      }),
    },
  };
  const service = createLoader({
    "@/lib/prisma": db,
    "@/lib/chatbot/server-access": {
      resolveChatbotOwner: async () => ({ status: 200 }),
    },
    "@/lib/investor-read.server": { withInvestorRead: async (fn) => fn({}) },
    "@/lib/investor-cma-legacy.server": {
      getMarketingInvestorCandidates: async (_, filters) => {
        state.filters = filters;
        return { items: [asset], total: 1 };
      },
    },
    "./security.server": security,
    "./store.server": {
      getSettings: async () => ({ config }),
      recentAssetKeys: async () => new Set(),
      json: (x) => JSON.parse(JSON.stringify(x)),
    },
    "./media.server": {
      buildMarketingMedia: async () => {
        state.render++;
        return [{ name: "feed.jpg", channel: "instagram" }];
      },
    },
    "./instagram.server": {},
    "./whatsapp.server": {},
  })("src/lib/marketing/service.server.ts");
  return {
    service,
    state,
    config,
    job: () => job,
    setAsset: (extra) => (asset = { ...asset, ...extra }),
    setJob: (extra) => (job = { ...job, ...extra }),
  };
}
test("preparation keeps the approved campaign caption after a global settings revision", async () => {
  const f = workerHarness();
  f.setJob({
    snapshot: Object.fromEntries(Object.entries(f.job().snapshot).reverse()),
  });
  const result = await f.service.prepareMarketingJob(f.job(), f.config);
  assert.equal(result.caption, "PESAN YANG SUDAH DISETUJUI");
  assert.equal(result.listingId, "1");
  assert.equal(f.state.filters.city, "");
  assert.deepEqual(f.state.filters.locations, brief().locations);
  assert.equal(result.settingsRevision, 9);
});
test("worker uses the approved campaign percent rule and holds jobs when that evidence drops", async () => {
  const f = workerHarness();
  f.setJob({
    plan: {
      ...f.job().plan,
      criteria: {
        ...f.job().plan.criteria,
        minSpread: 40,
        minDrop: 0,
        discountMode: "market",
      },
    },
  });
  const result = await f.service.prepareMarketingJob(f.job(), {
    ...f.config,
    minSpread: 99,
  });
  assert.equal(
    result.listingId,
    "1",
    "campaign threshold overrides later global threshold",
  );
  assert.equal(f.state.filters.discountMode, "market");
  assert.equal(f.state.filters.minSpread, 40);
  const renders = f.state.render;
  f.setAsset({ metricMarketSpreadPct: 39.99, metricAuctionDropPct: 90 });
  await assert.rejects(
    f.service.prepareMarketingJob(f.job(), f.config),
    (e) => e.code === "SELECTED_ASSET_UNAVAILABLE",
  );
  assert.equal(
    f.state.render,
    renders,
    "another passing metric cannot bypass the approved rule",
  );
  f.setJob({ scheduledFor: new Date(Date.now() - 1000) });
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.job().status, "review");
  assert.equal(f.job().reason, "CAMPAIGN_REVIEW_REQUIRED");
  assert.equal(
    f.state.render,
    renders,
    "no new materials or provider dispatch after evidence fails",
  );
});
test("campaign API enforces OWNER, Origin and validation before writes", async () => {
  const { NextRequest } = require("next/server");
  let status = 401,
    writes = 0;
  const route = createLoader({
    "@/lib/prisma": {},
    "@/lib/chatbot/server-access": {
      resolveChatbotOwner: async () => ({ status }),
    },
    "@/lib/marketing/campaigns.server": {
      listCampaigns: async () => ({ items: [], total: 0 }),
      saveCampaign: async () => {
        writes++;
        return {};
      },
    },
  })("src/app/api/dashboard/pemasaran/campaigns/route.ts");
  assert.equal(
    (
      await route.GET(
        new NextRequest(
          "https://example.test/api/dashboard/pemasaran/campaigns",
        ),
      )
    ).status,
    401,
  );
  status = 200;
  const read = await route.GET(
    new NextRequest("https://example.test/api/dashboard/pemasaran/campaigns"),
  );
  assert.equal(read.status, 200);
  assert.match(read.headers.get("Cache-Control"), /private, no-store/);
  const request = (origin, brief) =>
    new NextRequest("https://example.test/api/dashboard/pemasaran/campaigns", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", brief }),
    });
  assert.equal(
    (await route.POST(request("https://other.test", brief()))).status,
    403,
  );
  assert.equal(
    (
      await route.POST(
        request("https://example.test", {
          ...brief(),
          minPrice: 2e9,
          maxPrice: 1e9,
        }),
      )
    ).status,
    400,
  );
  for (const schedules of [
    ["1200"],
    ["24:00"],
    ["12:60"],
    ["12:30", "15:30", "13:40"],
    ["12:30", "12:30"],
  ]) {
    assert.equal(
      (
        await route.POST(
          request("https://example.test", { ...brief(), schedules }),
        )
      ).status,
      400,
      "invalid times cannot bypass UI validation via the API",
    );
  }
  for (const action of ["messages", "evaluate"]) {
    const response = await route.POST(
      new NextRequest(
        "https://example.test/api/dashboard/pemasaran/campaigns",
        {
          method: "POST",
          headers: {
            Origin: "https://example.test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            id: randomUUID(),
            revision: 1,
            proposalId: randomUUID(),
          }),
        },
      ),
    );
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});
test("changed campaign property requires review and never falls back to another asset", async () => {
  const f = workerHarness();
  f.setAsset({ currentAuctionPrice: 450e6 });
  await assert.rejects(
    f.service.prepareMarketingJob(f.job(), f.config),
    (e) => e.code === "CAMPAIGN_REVIEW_REQUIRED",
  );
  assert.equal(f.state.render, 0);
  assert.equal(f.job().caption, "PESAN YANG SUDAH DISETUJUI");
});
test("a paused campaign holds its job without rendering or clearing delivery evidence", async () => {
  const f = workerHarness();
  f.state.campaignState = "paused";
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.job().status, "paused");
  assert.equal(f.job().reason, "CAMPAIGN_PAUSED");
  assert.equal(f.state.render, 0);
  assert.equal(f.state.writes, 0);
});
test("an unavailable approved asset is marked for review before any provider dispatch", async () => {
  const f = workerHarness();
  f.setJob({ scheduledFor: new Date(Date.now() - 1000), listingId: "1" });
  f.setAsset({ status: "TERJUAL" });
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.job().status, "review");
  assert.equal(f.job().reason, "CAMPAIGN_REVIEW_REQUIRED");
  assert.equal(f.state.render, 0);
});
test("empty campaign reservations cannot fall back to automatic assets", async () => {
  const f = workerHarness();
  f.setJob({ plan: { ...f.job().plan, listingId: null } });
  await assert.rejects(
    f.service.prepareMarketingJob(f.job(), f.config),
    (e) => e.code === "CAMPAIGN_NO_ELIGIBLE_ASSET",
  );
  assert.equal(f.state.render, 0);
});

test("campaign preparation refuses auctions inside the safety window before rendering", async () => {
  const f = workerHarness();
  f.setAsset({
    listingCategory: "LELANG",
    auctionDate: new Date(Date.now() + 20 * 3600000).toISOString(),
  });
  await assert.rejects(
    f.service.prepareMarketingJob(f.job(), f.config),
    (e) => e.code === "SELECTED_ASSET_UNAVAILABLE",
  );
  assert.equal(f.state.render, 0);
});

test("regular scheduler holds approved campaign days even when global hours change", async () => {
  const slots = [],
    updates = [];
  const service = createLoader({
    "@/lib/prisma": {
      marketingJob: {
        createMany: async ({ data }) => {
          slots.push(...data);
          return { count: data.length };
        },
        updateMany: async (v) => {
          updates.push(v);
          return { count: 0 };
        },
      },
    },
    "./campaign-periods.server": {
      pendingCampaignSummaries: async () => [],
      activeCampaignPeriods: async () => [
        { startDate: "2026-11-01", endDate: "2026-11-02" },
      ],
    },
    "./store.server": {},
    "./media.server": {},
    "./instagram.server": {},
    "./whatsapp.server": {},
    "./security.server": security,
  })("src/lib/marketing/service.server.ts");
  await service.ensureSlots(
    { ...d.DEFAULT_CONFIG, schedules: ["10:10", "15:15"] },
    new Date("2026-11-01T00:00:00+07:00"),
  );
  assert.equal(slots.length, 4);
  assert.ok(
    slots.every(
      (s) => s.status === "skipped" && s.reason === "CAMPAIGN_SCHEDULE",
    ),
  );
  assert.ok(
    updates.every(
      (u) => u.where.campaignId === null && u.where.publications.none,
    ),
  );
});

test("example malformed hours explain the error in Indonesian without keeping stale jobs", () => {
  const brief = simulation.simulationBrief("2026-10-31");
  brief.schedules = ["25:10"];
  const result = simulation.projectSimulation(brief);
  assert.match(result.errors.schedules, /Gunakan format jam/);
  assert.equal(result.jobs.length, 0);
});

test("newest archive keeps real dates, photos, prices and percentage criteria intact", () => {
  const config = { ...d.DEFAULT_CONFIG, discountMode: "auction", minDrop: 50 };
  const rows = Array.from({ length: 9 }, (_, i) =>
    listing({
      id: String(i + 1),
      assetCode: "archive-" + i,
      listingCategory: "LELANG",
      metricAuctionDropPct: 60,
      auctionDate: `2026-06-${String(i + 1).padStart(2, "0")}T03:00:00Z`,
    }),
  );
  rows[8].metricAuctionDropPct = 49;
  rows[7].imageUrls = [];
  const before = JSON.stringify(rows);
  const archive = archiveHelpers.latestCampaignArchive(rows, config);
  assert.ok(archive);
  assert.equal(archive.assets.length, 6);
  assert.equal(archive.latestAuctionDate, rows[6].auctionDate);
  assert.equal(archive.assets[0].id, "7");
  assert.equal(
    JSON.stringify(rows),
    before,
    "read-only view never changes expired source facts",
  );
  assert.ok(
    archive.assets.every((asset) =>
      selection.campaignAssetAvailable(asset, new Date(archive.asOf)),
    ),
  );
  const original = { ...brief(), schedules: ["09:00", "13:00", "18:00"] };
  const seed = archiveHelpers.archiveCampaignBrief(original, archive);
  const view = simulation.projectSimulation(seed, archive.assets, "archive");
  assert.equal(view.jobs.filter((job) => job.listingId).length, 3);
  assert.equal(view.jobs[0].listingId, "7");
  assert.equal(view.jobs[0].snapshot.auctionDate, rows[6].auctionDate);
  assert.match(view.jobs[0].caption, /PRATINJAU ARSIP/);
  assert.equal(original.startDate, "2026-11-01");
  assert.ok(
    archive.assets.every(
      (asset) =>
        !selection.campaignAssetAvailable(
          asset,
          new Date("2026-10-31T00:00:00+07:00"),
        ),
    ),
    "archive preview must not turn expired property into live eligible stock",
  );
  assert.ok(view.jobs.every((job) => job.publications.length === 0));
  assert.equal(
    archiveHelpers.latestCampaignArchive(rows, { ...config, minDrop: 99 }),
    undefined,
  );
});

test("expired drafts and paused campaigns end at WIB midnight, using the applied period", () => {
  const past = brief({ startDate: "2026-10-28", endDate: "2026-10-31" });
  const future = brief();
  for (const state of ["draft", "paused", "running"])
    assert.equal(
      c.campaignStatus(
        { state, brief: past },
        new Date("2026-10-31T17:00:00Z"),
      ),
      "Berakhir",
    );
  assert.equal(
    c.campaignStatus(
      { state: "running", brief: future, activeBrief: past },
      new Date("2026-10-31T17:00:00Z"),
    ),
    "Berakhir",
  );
  assert.equal(
    c.campaignStatus(
      { state: "running", brief: past, activeBrief: future },
      new Date("2026-11-01T02:00:00Z"),
    ),
    "Aktif",
  );
});
test("approved execution period checks WIB midnight and ignores unapplied date edits", () => {
  const applied = brief({ startDate: "2026-10-28", endDate: "2026-10-31" });
  const row = { state: "running", brief: brief(), activeBrief: applied };
  const slot = new Date("2026-10-31T16:30:00Z");
  assert.equal(
    c.campaignExecutionIssue(row, slot, new Date("2026-10-31T16:59:59Z"), true),
    null,
  );
  assert.equal(
    c.campaignExecutionIssue(row, slot, new Date("2026-10-31T17:00:00Z"), true),
    "CAMPAIGN_ENDED",
  );
  assert.equal(
    c.campaignExecutionIssue(
      row,
      new Date("2026-11-01T02:00:00Z"),
      new Date("2026-10-31T16:00:00Z"),
    ),
    "CAMPAIGN_OUTSIDE_PERIOD",
  );
  const future = { state: "running", brief: applied, activeBrief: brief() };
  const futureSlot = new Date("2026-11-01T02:00:00Z");
  assert.equal(
    c.campaignExecutionIssue(
      future,
      futureSlot,
      new Date("2026-10-31T16:00:00Z"),
    ),
    null,
  );
  assert.equal(
    c.campaignExecutionIssue(
      future,
      futureSlot,
      new Date("2026-10-31T16:00:00Z"),
      true,
    ),
    "CAMPAIGN_OUTSIDE_PERIOD",
  );
});
test("expired approved campaign stops before media or dispatch, even after extending its draft", async () => {
  const f = workerHarness();
  f.state.activeBrief = brief({
    startDate: "2020-01-01",
    endDate: "2020-01-02",
  });
  await assert.rejects(
    f.service.prepareMarketingJob(f.job(), f.config),
    (e) => e.code === "CAMPAIGN_ENDED",
  );
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.job().status, "skipped");
  assert.equal(f.job().reason, "CAMPAIGN_ENDED");
  assert.equal(f.state.render, 0);
});
test("expired campaign retains published and ambiguous delivery evidence", async () => {
  for (const [publication, expected] of [
    ["published", "partial"],
    ["sending", "review"],
    ["uncertain", "review"],
  ]) {
    const f = workerHarness();
    f.state.activeBrief = brief({
      startDate: "2020-01-01",
      endDate: "2020-01-02",
    });
    f.state.publications = [{ state: publication, externalId: "evidence" }];
    await f.service.processMarketingJob(f.job(), f.config);
    assert.equal(f.job().status, expected);
    assert.deepEqual(f.state.publications, [
      { state: publication, externalId: "evidence" },
    ]);
    assert.equal(f.state.render, 0);
  }
});
test("invalid approved period requires review before any provider call", async () => {
  const f = workerHarness();
  f.state.activeBrief = {};
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.job().status, "review");
  assert.equal(f.job().reason, "CAMPAIGN_REVIEW_REQUIRED");
  assert.equal(f.state.render, 0);
});

const balancedBase = new Date("2026-11-01T02:00:00Z");
function balancedAsset(id, days, extra = {}) {
  return d.snapshotAsset(
    listing({
      id: String(id),
      assetCode: "balanced-" + id,
      listingCategory: "LELANG",
      auctionDate: new Date(
        balancedBase.getTime() + days * 86400000,
      ).toISOString(),
      sourceListedAt: "2026-10-30T00:00:00Z",
      ...extra,
    }),
  );
}
test("two urgent exposures alternate with coverage of distant auctions", () => {
  const assets = [
    balancedAsset(1, 10),
    balancedAsset(2, 11),
    balancedAsset(3, 12),
    balancedAsset(4, 13),
    balancedAsset(5, 30),
    balancedAsset(6, 40),
  ];
  const dates = [0, 4, 9, 24, 28, 33].map(
    (hours) => new Date(balancedBase.getTime() + hours * 3600000),
  );
  const slots = selection.selectCampaignAssets(
    assets,
    dates,
    7,
    () => new Set(),
    () => false,
  );
  assert.deepEqual(
    slots.map((slot) => slot.asset.id),
    ["1", "2", "5", "3", "4", "6"],
  );
  assert.match(slots[2].reason, /Pemerataan/);
});
test("single-upload campaigns retain the coverage turn across daily rebuilds and both channels count once", () => {
  const assets = [
    balancedAsset(1, 10),
    balancedAsset(2, 11),
    balancedAsset(3, 12),
    balancedAsset(4, 40),
  ];
  const jobs = [],
    chosen = [];
  for (let day = 0; day < 3; day++) {
    const when = new Date(balancedBase.getTime() + day * 86400000);
    const slot = selection.selectCampaignAssets(
      assets,
      [when, new Date(when.getTime() + 86400000)],
      7,
      () => new Set(),
      () => false,
      "fresh",
      selection.campaignExposureHistory(jobs, balancedBase),
      { schedules: ["09:00"] },
    )[0];
    chosen.push(slot.asset.id);
    jobs.push({
      assetKey: slot.asset.assetKey,
      scheduledFor: when,
      status: "completed",
      publications: [
        { state: "published", publishedAt: when },
        { state: "published", publishedAt: when },
      ],
    });
  }
  assert.deepEqual(chosen, ["1", "2", "4"]);
});
test("unseen urgent auction can rescue a coverage turn at its last safe opportunity", () => {
  const soon = balancedAsset(1, 5.5),
    far = balancedAsset(2, 40);
  const history = () =>
    new Map([
      ["elsewhere", { count: 2, lastAt: balancedBase.getTime() - 86400000 }],
    ]);
  const slots = selection.selectCampaignAssets(
    [soon, far],
    [balancedBase, new Date(balancedBase.getTime() + 86400000)],
    7,
    () => new Set(),
    () => false,
    "fresh",
    history,
  );
  assert.equal(slots[0].asset.id, "1");
  assert.match(slots[0].reason, /Kesempatan terakhir/);
  assert.equal(slots[1].asset.id, "2");
});
test("coverage chooses never-exposed stock before repeating distant auctions", () => {
  const a = balancedAsset(1, 40),
    b = balancedAsset(2, 50);
  const history = () =>
    new Map([
      [
        a.assetKey,
        { count: 2, lastAt: balancedBase.getTime() - 20 * 86400000 },
      ],
    ]);
  const result = selection.selectCampaignAssets(
    [a, b],
    [balancedBase],
    7,
    () => new Set(),
    () => false,
    "fresh",
    history,
  );
  assert.equal(result[0].asset.id, "2");
});
test("missed unattempted jobs do not become exposure and ambiguous delivery is retained", () => {
  const before = new Date(balancedBase.getTime() - 86400000);
  const rows = [
    {
      assetKey: "missed",
      scheduledFor: before,
      status: "skipped",
      publications: [],
    },
    {
      assetKey: "stale-queue",
      scheduledFor: before,
      status: "queued",
      publications: [],
    },
    {
      assetKey: "ambiguous",
      scheduledFor: before,
      status: "review",
      publications: [{ state: "uncertain" }],
    },
    {
      assetKey: "sent",
      scheduledFor: before,
      status: "completed",
      publications: [
        { state: "published", publishedAt: before },
        { state: "published", publishedAt: before },
      ],
    },
  ];
  const history = selection.campaignExposureHistory(
    rows,
    balancedBase,
  )(balancedBase);
  assert.equal(history.has("missed"), false);
  assert.equal(history.has("stale-queue"), false);
  assert.equal(history.get("ambiguous").count, 1);
  assert.equal(history.get("sent").count, 1);
});
test("five-day eligibility is shared by campaign and regular marketing selection at millisecond boundaries", () => {
  for (const [offset, expected] of [
    [-1, false],
    [0, true],
    [1, true],
  ]) {
    const source = listing({
      listingCategory: "LELANG",
      auctionDate: new Date(
        balancedBase.getTime() + 5 * 86400000 + offset,
      ).toISOString(),
    });
    assert.equal(
      d.eligibleAsset(source, d.DEFAULT_CONFIG, balancedBase),
      expected,
    );
    assert.equal(
      selection.campaignAssetAvailable(d.snapshotAsset(source), balancedBase),
      expected,
    );
  }
});
test("balanced selection never fills through exclusions, cooldown, missing images or unsafe deadlines", () => {
  const a = balancedAsset(1, 10),
    unsafe = balancedAsset(2, 4),
    noPhoto = { ...balancedAsset(3, 20), images: [] };
  const blocked = selection.selectCampaignAssets(
    [a, unsafe, noPhoto],
    [balancedBase],
    7,
    () => new Set([a.assetKey]),
    () => false,
  );
  assert.equal(blocked[0].asset, null);
  const slots = selection.selectCampaignAssets(
    [a, { ...a, id: "9" }],
    [balancedBase, new Date(balancedBase.getTime() + 3600000)],
    7,
    () => new Set(),
    () => false,
  );
  assert.equal(slots.filter((slot) => slot.asset).length, 1);
});

test("worker refuses a four-day auction before media preparation despite an older approved plan", async () => {
  const f = workerHarness();
  f.setAsset({
    listingCategory: "LELANG",
    auctionDate: new Date(Date.now() + 4 * 86400000).toISOString(),
  });
  await assert.rejects(
    f.service.prepareMarketingJob(f.job(), f.config),
    (e) => e.code === "SELECTED_ASSET_UNAVAILABLE",
  );
  assert.equal(f.state.render, 0);
});

test("ending a campaign does not misclassify every distant deadline as a last-chance rescue", () => {
  const assets = [1, 2, 3, 4].map((id) => balancedAsset(id, 9 + id));
  assets.push(balancedAsset(5, 40));
  const dates = [0, 4, 9].map(
    (hour) => new Date(balancedBase.getTime() + hour * 3600000),
  );
  const slots = selection.selectCampaignAssets(
    assets,
    dates,
    7,
    () => new Set(),
    () => false,
  );
  assert.deepEqual(
    slots.map((slot) => slot.asset.id),
    ["1", "2", "5"],
  );
});
test("a future unfilled campaign slot is not displayed as already skipped", () => {
  const job = {
    campaignId: randomUUID(),
    scheduledFor: "2026-11-02T02:00:00Z",
    status: "skipped",
    reason: "CAMPAIGN_NO_ELIGIBLE_ASSET",
    listingId: null,
    plan: { ...campaignPlan(), listingId: null },
    publications: [],
  };
  assert.equal(
    planner.slotState(job, new Date("2026-11-01T02:00:00Z")),
    "unfilled",
  );
  assert.equal(
    planner.slotState(job, new Date("2026-11-03T02:00:00Z")),
    "skipped",
  );
});

test("twelve daily sessions allocate eight near and four coverage slots without repeats", () => {
  const assets = Array.from({ length: 90 }, (_, index) =>
    balancedAsset(index + 1, index < 60 ? 12 + (index % 3) * 0.1 : 40),
  );
  const dates = Array.from(
    { length: 36 },
    (_, index) =>
      new Date(
        balancedBase.getTime() +
          Math.floor(index / 12) * 86400000 +
          (index % 12) * 3600000,
      ),
  );
  const slots = selection.selectCampaignAssets(
    assets,
    dates,
    7,
    () => new Set(),
    () => false,
  );
  assert.equal(slots.filter((slot) => Number(slot.asset.id) <= 60).length, 24);
  assert.equal(slots.filter((slot) => Number(slot.asset.id) > 60).length, 12);
  assert.equal(new Set(slots.map((slot) => slot.asset.assetKey)).size, 36);
  assert.ok(
    slots.every(
      (slot) =>
        Date.parse(slot.asset.auctionDate) - slot.when.getTime() >=
        5 * 86400000,
    ),
  );
});

test("daily allocation follows every supported intensity, including five sessions over three WIB days", () => {
  for (let sessions = 2; sessions <= 12; sessions++) {
    const schedules = Array.from(
      { length: sessions },
      (_, i) => String(i + 7).padStart(2, "0") + ":00",
    );
    const input = {
      ...simulation.simulationBrief("2026-11-01"),
      endDate: "2026-11-03",
      schedules,
    };
    const dates = c.campaignSchedule(input, new Date("2026-10-31T17:00:00Z"));
    const assets = Array.from({ length: 90 }, (_, i) =>
      balancedAsset(i + 1, i < 60 ? 12 : 40),
    );
    const slots = selection.selectCampaignAssets(
      assets,
      dates,
      7,
      () => new Set(),
      () => false,
      "fresh",
      undefined,
      input,
    );
    const allocation = selection.campaignDailyAllocation(sessions);
    for (const day of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
      const daily = slots.filter((slot) => d.jakartaDate(slot.when) === day);
      assert.equal(daily.length, sessions);
      assert.equal(
        daily.filter((slot) => +slot.asset.id <= 60).length,
        allocation.urgent,
      );
      assert.equal(
        daily.filter((slot) => +slot.asset.id > 60).length,
        allocation.coverage,
      );
    }
    assert.equal(
      new Set(slots.map((slot) => slot.asset.assetKey)).size,
      sessions * 3,
    );
  }
  assert.deepEqual(selection.campaignDailyAllocation(5), {
    total: 5,
    urgent: 3,
    coverage: 2,
  });
  assert.match(
    selection.campaignAllocationLabel(5),
    /5 sesi.*3 prioritas.*2 pemerataan/,
  );
});

test("regenerating after morning keeps the five-session day's original coverage positions", () => {
  const rhythm = { schedules: ["07:00", "09:00", "11:00", "14:00", "18:00"] };
  const dates = rhythm.schedules
    .slice(2)
    .map((time) => new Date("2026-11-01T" + time + ":00+07:00"));
  const assets = Array.from({ length: 12 }, (_, i) =>
    balancedAsset(i + 1, i < 6 ? 12 : 40),
  );
  const slots = selection.selectCampaignAssets(
    assets,
    dates,
    7,
    () => new Set(),
    () => false,
    "fresh",
    undefined,
    rhythm,
  );
  assert.deepEqual(
    slots.map((slot) => +slot.asset.id > 6),
    [true, false, true],
  );
});

const fiveSessionPeriod = (state = "draft") => ({
  startDate: "2026-11-01",
  endDate: "2026-11-03",
  plan: {
    id: "five-session-campaign",
    name: "Lima sesi",
    state,
    schedules: ["07:00", "09:00", "11:00", "14:00", "18:00"],
    channels: ["instagram"],
  },
});

test("Planner shows exactly fifteen campaign sessions with zero inventory, never global default hours", () => {
  const period = fiveSessionPeriod();
  const now = new Date("2026-11-01T05:00:00Z");
  const automatic = ["09:00", "13:00", "18:00"].map((time) => ({
    id: time,
    scheduledFor: "2026-11-01T" + time + ":00+07:00",
    status: "skipped",
    reason: "PAUSED",
    listingId: null,
    publications: [],
  }));
  const result = planner.plannerSlots(
    d.DEFAULT_CONFIG,
    automatic,
    "2026-11",
    now,
    [period],
  );
  const campaignSlots = result.filter((slot) => slot.campaign);
  assert.equal(campaignSlots.length, 15);
  for (const day of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
    const daily = result.filter((slot) => slot.date === day);
    assert.equal(daily.length, 5);
    assert.deepEqual(
      daily.map((slot) =>
        new Date(Date.parse(slot.scheduledFor) + 7 * 3600000)
          .toISOString()
          .slice(11, 16),
      ),
      period.plan.schedules,
    );
    assert.ok(
      daily.every(
        (slot) => slot.job === null && slot.channels.join() === "instagram",
      ),
    );
  }
  assert.equal(
    campaignSlots.filter(
      (slot) => planner.plannerSlotState(slot, now) === "elapsed",
    ).length,
    3,
  );
  assert.equal(
    campaignSlots.filter(
      (slot) => planner.plannerSlotState(slot, now) === "draft",
    ).length,
    12,
  );
  assert.equal(result.filter((slot) => slot.date === "2026-11-04").length, 3);
});

test("approved sessions override unapplied rhythm changes while delivery evidence and manual plans remain visible", () => {
  const approved = fiveSessionPeriod("running"),
    draft = {
      ...fiveSessionPeriod(),
      plan: { ...fiveSessionPeriod().plan, schedules: ["06:00"] },
    };
  const jobs = [
    {
      id: "published",
      listingId: "1",
      scheduledFor: "2026-11-01T13:00:00+07:00",
      status: "completed",
      publications: [
        { channel: "instagram", state: "published", attemptCount: 1 },
      ],
    },
    {
      id: "attempted",
      listingId: null,
      scheduledFor: "2026-11-01T13:30:00+07:00",
      status: "review",
      publications: [
        { channel: "instagram", state: "uncertain", attemptCount: 1 },
      ],
    },
    {
      id: "assigned",
      listingId: null,
      plan: campaignPlan(),
      scheduledFor: "2026-11-02T09:00:00+07:00",
      status: "queued",
      publications: [],
    },
  ];
  const slots = planner.plannerSlots(
    d.DEFAULT_CONFIG,
    jobs,
    "2026-11",
    balancedBase,
    [draft, approved],
  );
  assert.ok(
    !slots.some(
      (slot) => slot.campaign && slot.scheduledFor.endsWith("T23:00:00.000Z"),
    ),
  );
  assert.ok(jobs.every((job) => slots.some((slot) => slot.job?.id === job.id)));
  assert.equal(slots.filter((slot) => slot.date === "2026-11-02").length, 5);
  const gap = slots.find((slot) => slot.date === "2026-11-02" && !slot.job);
  assert.equal(planner.plannerSlotState(gap, balancedBase), "unfilled");
});

test("campaign session projection clips at WIB month boundaries and supports all twelve times", () => {
  const period = {
    ...fiveSessionPeriod(),
    startDate: "2026-10-31",
    endDate: "2026-11-02",
    plan: {
      ...fiveSessionPeriod().plan,
      schedules: Array.from(
        { length: 12 },
        (_, i) => String(i).padStart(2, "0") + ":00",
      ),
    },
  };
  for (const [month, count] of [
    ["2026-10", 12],
    ["2026-11", 24],
  ]) {
    const slots = planner
      .plannerSlots(d.DEFAULT_CONFIG, [], month, balancedBase, [period])
      .filter((slot) => slot.campaign);
    assert.equal(slots.length, count);
    assert.ok(slots.every((slot) => slot.date.startsWith(month)));
  }
});

test("other campaign reservations between slots do not move this campaign's coverage turn", () => {
  const assets = [
    balancedAsset(1, 10),
    balancedAsset(2, 11),
    balancedAsset(3, 12),
    balancedAsset(4, 40),
  ];
  const dates = [0, 4, 9].map(
    (hours) => new Date(balancedBase.getTime() + hours * 3600000),
  );
  const history = (when) =>
    when > balancedBase
      ? new Map([
          ["other-campaign", { count: 4, lastAt: balancedBase.getTime() }],
        ])
      : new Map();
  const slots = selection.selectCampaignAssets(
    assets,
    dates,
    7,
    () => new Set(),
    () => false,
    "fresh",
    history,
  );
  assert.deepEqual(
    slots.map((slot) => slot.asset.id),
    ["1", "2", "4"],
  );
});

const batches = load("src/lib/marketing/campaign-batches.ts");
test("two-day batches prepare the next carriage one day early and clip an odd final day", () => {
  const input = {
    ...brief(),
    startDate: "2026-11-01",
    endDate: "2026-11-03",
    schedules: ["07:00", "09:00", "11:00", "14:00", "18:00"],
  };
  const morning = (day) => new Date(day + "T00:00:00+07:00");
  const first = batches.campaignBatch(input, morning("2026-11-01"));
  assert.deepEqual(first, {
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    nextRefreshAt: "2026-11-01T17:00:00.000Z",
  });
  assert.equal(
    batches.campaignPreparationDates(input, morning("2026-11-01")).length,
    10,
  );
  const next = batches.campaignBatch(input, morning("2026-11-02"));
  assert.deepEqual(next, {
    startDate: "2026-11-03",
    endDate: "2026-11-03",
    nextRefreshAt: null,
  });
  assert.equal(
    batches.campaignPreparationDates(input, morning("2026-11-02")).length,
    10,
  );
  assert.equal(
    batches.campaignPreparationDates(input, morning("2026-11-03")).length,
    5,
  );
  assert.equal(batches.campaignBatch(input, morning("2026-11-04")), null);
  assert.equal(
    batches.campaignPreparationDates(input, morning("2026-11-04")).length,
    0,
  );
  for (const [day, start, end] of [
    [1, 1, 2],
    [2, 3, 4],
    [3, 3, 4],
    [4, 5, 6],
    [6, 7, 7],
  ]) {
    const batch = batches.campaignBatch(
      { ...input, endDate: "2026-11-07" },
      morning(`2026-11-0${day}`),
    );
    assert.equal(batch.startDate, `2026-11-0${start}`);
    assert.equal(batch.endDate, `2026-11-0${end}`);
  }
});
test("batch boundaries retain WIB midnight and month/year rollover", () => {
  const input = {
    startDate: "2026-12-31",
    endDate: "2027-01-02",
    schedules: ["00:00", "23:59"],
  };
  assert.equal(
    batches.campaignBatch(input, new Date("2026-12-31T16:59:59.999Z"))
      .startDate,
    "2026-12-31",
  );
  assert.equal(
    batches.campaignBatch(input, new Date("2026-12-31T17:00:00Z")).startDate,
    "2027-01-02",
  );
  assert.equal(
    batches.campaignBatch(input, new Date("2026-12-01")).startDate,
    "2026-12-31",
  );
});
test("live queue cannot repeat a parcel even when its cooldown has elapsed", () => {
  const dates = [balancedBase, new Date(balancedBase.getTime() + 8 * 86400000)];
  const asset = balancedAsset(1, 40);
  const slots = selection.selectCampaignAssets(
    [asset, { ...asset, id: "2" }],
    dates,
    0,
    () => new Set(),
    () => false,
    "fresh",
    undefined,
    { schedules: ["09:00"], noRepeat: true },
  );
  assert.equal(slots[0].asset.id, "1");
  assert.equal(slots[1].asset, null);
});
test("publication deduplication has no date cutoff, protects uncertain sends and aliases, and excludes the same job", async () => {
  const asset = balancedAsset(1, 40);
  let query;
  const dedup = createLoader({
    "@/lib/prisma": {
      marketingJob: {
        findMany: async (input) => {
          query = input;
          return [
            {
              id: "published-years-ago",
              assetKey: asset.assetKey,
              listingId: "1",
              snapshot: {},
            },
            {
              id: "current",
              assetKey: "same-job-only",
              listingId: "2",
              snapshot: {},
            },
          ];
        },
      },
    },
  })("src/lib/marketing/campaign-dedup.server.ts");
  const keys = await dedup.marketedAssetKeys([asset], "current");
  assert.ok(keys.has(asset.assetKey));
  assert.ok(!keys.has("same-job-only"));
  assert.equal(JSON.stringify(query).includes("scheduledFor"), false);
  assert.deepEqual(query.where.id, { notIn: ["current"] });
  assert.deepEqual(query.where.publications.some.OR[0].state.in, [
    "published",
    "sending",
    "uncertain",
  ]);
});

test("deduplication matches snapshot-only and manual-plan IDs after a parcel alias changes", async () => {
  const queries = [];
  const assets = [balancedAsset(1, 40), balancedAsset(2, 40)];
  const dedup = createLoader({
    "@/lib/prisma": {
      marketingJob: {
        findMany: async (query) => {
          queries.push(query);
          return [
            {
              id: "old-snapshot",
              assetKey: "legacy-parcel",
              listingId: null,
              snapshot: { id: assets[0].id },
              plan: {},
            },
            {
              id: "manual-plan",
              assetKey: null,
              listingId: null,
              snapshot: {},
              plan: { listingId: assets[1].id },
            },
          ];
        },
      },
    },
  })("src/lib/marketing/campaign-dedup.server.ts");
  assert.deepEqual(
    await dedup.marketedAssetKeys(assets),
    new Set(assets.map((asset) => asset.assetKey)),
  );
  assert.ok(
    queries[0].where.OR.some((filter) => filter.snapshot?.path?.[0] === "id"),
  );
  assert.ok(
    queries[0].where.OR.some(
      (filter) => filter.plan?.path?.[0] === "listingId",
    ),
  );
});

test("reservations include paused and elapsed assignments across batches while excluding only replaced jobs", async () => {
  const asset = balancedAsset(1, 40);
  let query;
  const dedup = createLoader({
    "@/lib/prisma": {
      marketingJob: {
        findMany: async (input) => {
          query = input;
          return [
            {
              id: "earlier-batch",
              assetKey: asset.assetKey,
              snapshot: {},
              plan: {},
            },
          ];
        },
      },
    },
  })("src/lib/marketing/campaign-dedup.server.ts");
  assert.ok(
    (await dedup.reservedAssetKeys([asset], ["replaced-current-slot"])).has(
      asset.assetKey,
    ),
  );
  assert.equal(query.where.scheduledFor, undefined);
  assert.equal(query.where.campaignId, undefined);
  assert.ok(query.where.status.in.includes("paused"));
  assert.deepEqual(query.where.id.notIn, ["replaced-current-slot"]);
  const before = new Date("2026-11-04T08:00:00+07:00");
  await dedup.reservedAssetKeys([asset], ["current-job"], before);
  assert.deepEqual(query.where.scheduledFor, { lt: before });
});
