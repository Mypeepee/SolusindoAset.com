// Real transactions/leases, fixture inventory/rendering. Never dispatches social media.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const createLoader = require("./lib/marketing-test-loader.cjs");
require("dotenv").config({ quiet: true });
require("dotenv").config({ path: ".env.local", override: true, quiet: true });
const db = new PrismaClient(),
  ids = [],
  extraJobs = [];
const load = createLoader({
  "@/lib/prisma": db,
  "@/lib/chatbot/server-access": {
    resolveChatbotOwner: async () => ({ status: 200 }),
  },
  "./instagram.server": {},
  "./whatsapp.server": {},
  "./media.server": {},
});
const d = load("src/lib/marketing/domain.ts"),
  c = load("src/lib/marketing/campaign.ts"),
  runtime = load("src/lib/marketing/service.server.ts"),
  periods = load("src/lib/marketing/campaign-periods.server.ts");
const fixtures = Array.from({ length: 48 }, (_, i) => ({
  id: String(900000000000000000n + BigInt(i)),
  assetCode: "campaign-qa-" + i,
  title: "Rumah uji",
  cityName: i < 24 ? "Kota Surabaya" : "Kabupaten Sidoarjo",
  kelurahanId: "fixture-kel",
  kelurahanName: "Lokasi uji",
  address: "Properti pengujian " + i,
  currentAuctionPrice: 400e6,
  landAreaSqm: 100,
  metricAuctionDropPct: null,
  metricMarketSpreadPct: 80,
  transactionType: "BELI",
  listingCategory: "SECONDARY",
  propertyType: "RUMAH",
  status: "TERSEDIA",
  auctionDate: null,
  imageUrls: ["https://example.test/fixture.jpg"],
  listingUrl: "/Jual/fixture",
  sourceRevision: "fixture",
}));
const server = createLoader({
  "@/lib/prisma": db,
  "@/lib/chatbot/server-access": {
    resolveChatbotOwner: async () => ({ status: 200 }),
  },
  "@/lib/investor-read.server": { withInvestorRead: async (fn) => fn({}) },
  "@/lib/investor-cma-legacy.server": {
    getMarketingInvestorScope: async (_, filters) =>
      fixtures.filter(
        (x) =>
          (!filters.propertyTypes?.length ||
            filters.propertyTypes.includes(x.propertyType)) &&
          (!filters.locations.length ||
            filters.locations[0].name === x.cityName),
      ),
    getMarketingInvestorCandidates: async (
      _,
      filters,
      excluded,
      offset = 0,
      limit = 100,
    ) => {
      const rows = fixtures.filter(
        (x) =>
          (!filters.propertyTypes?.length ||
            filters.propertyTypes.includes(x.propertyType)) &&
          (!filters.locations.length ||
            filters.locations[0].name === x.cityName) &&
          (!filters.query || x.id === filters.query),
      );
      return { items: rows.slice(offset, offset + limit), total: rows.length };
    },
  },
  "./service.server": {
    lease: runtime.lease,
    assertWorkerLease: runtime.assertWorkerLease,
    sourceStillMatches: async () => true,
  },
  "./media.server": {
    buildMarketingMedia: async () => [
      { name: "feed.jpg", channel: "instagram" },
    ],
  },
})("src/lib/marketing/campaigns.server.ts");
(async () => {
  try {
    const settings = await db.marketingSettings.findUniqueOrThrow({
      where: { id: "company" },
    });
    assert.equal(settings.enabled, false);
    const published = await db.marketingPublication.count({
        where: { state: "published" },
      }),
      config = { ...d.DEFAULT_CONFIG, ...settings.config };
    let start, end;
    for (let offset = 35; offset < 80; offset += 3) {
      start = d.jakartaDate(new Date(Date.now() + offset * 86400000));
      end = d.jakartaDate(new Date(Date.now() + (offset + 2) * 86400000));
      if (
        !(await db.marketingJob.count({
          where: {
            scheduledFor: {
              gte: new Date(start + "T00:00:00+07:00"),
              lte: new Date(end + "T23:59:59+07:00"),
            },
          },
        }))
      )
        break;
      start = null;
    }
    assert.ok(start, "Need a vacant three-day QA window");
    const brief = (
      name,
      city = "Kota Surabaya",
      schedules = ["08:15", "17:45"],
    ) => ({
      name,
      startDate: start,
      endDate: end,
      schedules,
      listingIds: fixtures
        .filter((x) => x.cityName === city)
        .slice(0, 8)
        .map((x) => x.id),
      channels: [config.instagram ? "instagram" : "whatsapp"],
      city: "",
      locations: [
        {
          id: city === "Kota Surabaya" ? "3578" : "3515",
          name: city,
          level: "kota",
        },
      ],
      category: "ALL",
      propertyTypes: ["RUMAH"],
      minPrice: null,
      maxPrice: 1e9,
    });
    const create = async (b) => {
      const x = await server.saveCampaign({ brief: b });
      ids.push(x.campaign.id);
      return x;
    };
    const generate = async (x) =>
      server.generateCampaign(x.campaign.id, x.campaign.revision);
    const apply = async (x) =>
      server.approveCampaign(x.campaign.id, x.campaign.revision, x.proposal.id);
    {
      // Lifecycle filtering happens before pagination, independently for each group.
      const groupNow = new Date("2031-01-05T16:59:59Z");
      const pastBrief = {
        ...brief("QA grouped past"),
        startDate: "2031-01-01",
        endDate: "2031-01-04",
      };
      const todayBrief = {
        ...pastBrief,
        name: "QA grouped today",
        endDate: "2031-01-05",
      };
      const nextBrief = {
        ...pastBrief,
        name: "QA grouped future",
        startDate: "2031-01-06",
        endDate: "2031-01-08",
      };
      const beforeGroups = await server.listCampaignGroups(1, 1, groupNow);
      const groupRows = [
        ...Array.from({ length: 22 }, () => ({
          state: "draft",
          brief: nextBrief,
          activeBrief: {},
        })),
        ...Array.from({ length: 22 }, () => ({
          state: "draft",
          brief: pastBrief,
          activeBrief: {},
        })),
        { state: "running", brief: nextBrief, activeBrief: pastBrief },
        { state: "running", brief: pastBrief, activeBrief: nextBrief },
        { state: "paused", brief: pastBrief, activeBrief: todayBrief },
        { state: "running", brief: pastBrief, activeBrief: {} },
        { state: "running", brief: nextBrief, activeBrief: {} },
        { state: "draft", brief: nextBrief, activeBrief: pastBrief },
      ].map((row) => ({
        ...row,
        id: randomUUID(),
        updatedAt: new Date("2090-01-01T00:00:00Z"),
      }));
      ids.push(...groupRows.map((row) => row.id));
      await db.marketingCampaign.createMany({ data: groupRows });
      const grouped = await server.listCampaignGroups(1, 1, groupNow);
      assert.equal(grouped.current.total, beforeGroups.current.total + 26);
      assert.equal(grouped.ended.total, beforeGroups.ended.total + 24);
      assert.equal(grouped.current.items.length, 20);
      assert.equal(grouped.ended.items.length, 20);
      const groupedPage2 = await server.listCampaignGroups(2, 2, groupNow);
      for (const [key, isEnded] of [
        ["current", false],
        ["ended", true],
      ]) {
        const bothPages = [...grouped[key].items, ...groupedPage2[key].items];
        assert.equal(
          new Set(bothPages.map((row) => row.id)).size,
          bothPages.length,
        );
        assert.ok(
          bothPages.every(
            (row) =>
              (c.campaignStatus(row, groupNow) === "Berakhir") === isEnded,
          ),
        );
        const expected = groupRows.filter((row) => {
          const record = {
            ...row,
            activeBrief: c.storedCampaignBriefSchema.safeParse(row.activeBrief)
              .success
              ? row.activeBrief
              : null,
          };
          return (
            (c.campaignStatus(record, groupNow) === "Berakhir") === isEnded
          );
        });
        assert.ok(
          expected.every((row) => bothPages.some((item) => item.id === row.id)),
        );
      }
      const midnightGroups = await server.listCampaignGroups(
        1,
        1,
        new Date("2031-01-05T17:00:00Z"),
      );
      assert.equal(midnightGroups.current.total, grouped.current.total - 1);
      assert.equal(midnightGroups.ended.total, grouped.ended.total + 1);
      const clampedGroups = await server.listCampaignGroups(
        10000,
        10000,
        groupNow,
      );
      assert.equal(
        clampedGroups.current.page,
        Math.max(1, Math.ceil(grouped.current.total / 20)),
      );
      assert.equal(
        clampedGroups.ended.page,
        Math.max(1, Math.ceil(grouped.ended.total / 20)),
      );
      await db.marketingCampaign.deleteMany({
        where: { id: { in: groupRows.map((row) => row.id) } },
      });
    }
    const draftOnly = await create({
      ...brief("QA simpan tanpa aset", "Kota Surabaya", [
        "07:00",
        "09:00",
        "11:00",
        "14:00",
        "18:00",
      ]),
      listingIds: [],
      minSpread: 100,
      minDrop: 100,
      discountMode: "auction",
    });
    assert.equal(draftOnly.campaign.state, "draft");
    assert.deepEqual(draftOnly.campaign.brief.listingIds, []);
    assert.equal(draftOnly.proposal, null);
    assert.equal(draftOnly.jobsTotal, 0);
    const revisedDraft = await server.saveCampaign({
      id: draftOnly.campaign.id,
      revision: draftOnly.campaign.revision,
      brief: { ...draftOnly.campaign.brief, minDrop: 30 },
    });
    assert.equal(revisedDraft.campaign.id, draftOnly.campaign.id);
    assert.equal(revisedDraft.campaign.brief.minDrop, 30);
    assert.equal(revisedDraft.proposal, null);
    assert.equal(revisedDraft.jobsTotal, 0);
    const draftMonth = await runtime.plannerMonth(start.slice(0, 7));
    const savedPeriod = draftMonth.campaignPeriods.find(
      (period) => period.plan?.id === draftOnly.campaign.id,
    );
    assert.equal(savedPeriod.plan.state, "draft");
    assert.equal(savedPeriod.plan.schedules.length, 5);
    const draftProjection = load("src/lib/marketing/planner.ts").plannerSlots(
      config,
      draftMonth.jobs,
      start.slice(0, 7),
      new Date(),
      draftMonth.campaignPeriods,
    );
    const projectedDays = [0, 1, 2].filter((offset) =>
      d
        .jakartaDate(
          new Date(Date.parse(start + "T00:00:00+07:00") + offset * 86400000),
        )
        .startsWith(start.slice(0, 7)),
    ).length;
    assert.equal(
      draftProjection.filter(
        (slot) => slot.campaign?.id === draftOnly.campaign.id,
      ).length,
      projectedDays * 5,
    );
    const inventory = await server.campaignInventory({
      criteria: c.campaignCriteria(brief("Inventory")),
      startDate: start,
      endDate: end,
      listingIds: [fixtures[0].id, fixtures[47].id],
      query: "",
      offset: 0,
    });
    assert.equal(inventory.total, 24);
    assert.equal(inventory.diagnostics.total, 24);
    assert.equal(inventory.diagnostics.ready, 24);
    assert.equal(inventory.items.length, 20);
    assert.ok(inventory.recommendation.assets.length > 0);
    assert.equal(
      inventory.recommendation.filled,
      inventory.recommendation.target,
    );
    assert.ok(inventory.selected[0].asset);
    assert.equal(inventory.selected[1].asset, null);
    const ended = d.jakartaDate(new Date(Date.now() - 86400000));
    const endedStock = await server.campaignInventory({
      criteria: c.campaignCriteria(brief("QA periode lewat")),
      startDate: ended,
      endDate: ended,
      schedules: ["00:00"],
      listingIds: [],
      query: "",
      offset: 0,
    });
    assert.equal(
      endedStock.total,
      24,
      "ended campaign still exposes current inventory",
    );
    assert.equal(endedStock.recommendation.target, 0);
    assert.deepEqual(endedStock.recommendation.assets, []);
    const savedAuction = { ...fixtures[0] };
    Object.assign(fixtures[0], {
      listingCategory: "LELANG",
      auctionDate: "2026-07-02T17:00:00Z",
    });
    const expiredStock = await server.campaignInventory({
      criteria: c.campaignCriteria(brief("QA sumber kedaluwarsa")),
      startDate: start,
      endDate: end,
      listingIds: [],
      query: "",
      offset: 0,
    });
    assert.equal(expiredStock.diagnostics.expired, 1);
    assert.equal(expiredStock.diagnostics.total, 24);
    assert.equal(expiredStock.diagnostics.ready, 23);
    assert.ok(!expiredStock.items.some((x) => x.id === fixtures[0].id));
    Object.assign(fixtures[0], savedAuction);
    const page2 = await server.campaignInventory({
      criteria: c.campaignCriteria(brief("Inventory")),
      startDate: start,
      endDate: end,
      listingIds: [],
      query: "",
      offset: 20,
    });
    assert.equal(page2.items.length, 4);
    const found = await server.campaignInventory({
      criteria: c.campaignCriteria(brief("Inventory")),
      startDate: start,
      endDate: end,
      listingIds: [],
      query: "pengujian 23",
      offset: 0,
    });
    assert.equal(found.total, 1);
    // One asset qualifies by local benchmark, another by auction history only.
    const original = fixtures.slice(0, 2).map((asset) => ({ ...asset }));
    Object.assign(fixtures[0], {
      metricMarketSpreadPct: 95,
      metricAuctionDropPct: 10,
    });
    Object.assign(fixtures[1], {
      metricMarketSpreadPct: 10,
      metricAuctionDropPct: 95,
      listingCategory: "LELANG",
      auctionDate: new Date(Date.parse(end) + 7 * 86400000).toISOString(),
    });
    for (const [discountMode, expected] of [
      ["market", [fixtures[0].id]],
      ["auction", [fixtures[1].id]],
      ["either", fixtures.slice(0, 2).map((x) => x.id)],
    ]) {
      const discounted = await server.campaignInventory({
        criteria: {
          ...c.campaignCriteria(brief("QA ambang persen")),
          minSpread: 95,
          minDrop: 95,
          discountMode,
        },
        startDate: start,
        endDate: end,
        listingIds: fixtures.slice(0, 3).map((x) => x.id),
        query: "",
        offset: 0,
      });
      assert.deepEqual(
        discounted.items.map((x) => x.id).sort(),
        expected.slice().sort(),
      );
      assert.deepEqual(
        discounted.selected
          .filter((x) => x.asset)
          .map((x) => x.id)
          .sort(),
        expected.slice().sort(),
      );
      assert.ok(
        discounted.recommendation.assets.every((x) => expected.includes(x.id)),
      );
    }
    let discounted = await generate(
      await create({
        ...brief("QA diskon tersimpan"),
        listingIds: [fixtures[0].id],
        minSpread: 95,
        minDrop: 0,
        discountMode: "market",
      }),
    );
    assert.equal(discounted.campaign.brief.minSpread, 95);
    assert.equal(discounted.campaign.brief.discountMode, "market");
    assert.equal(discounted.proposal.data.slots.length, 1);
    assert.equal(discounted.proposal.data.slots[0].asset.marketSpreadPct, 95);
    // Auction drop would still pass OR at zero: selected market rule must reject it.
    fixtures[0].metricMarketSpreadPct = 94.99;
    await assert.rejects(
      apply(discounted),
      (e) => e.code === "CAMPAIGN_REVIEW_REQUIRED",
    );
    fixtures[0].metricMarketSpreadPct = 95;
    discounted = await apply(discounted);
    const discountJob = await db.marketingJob.findUniqueOrThrow({
      where: { id: discounted.jobs[0].id },
    });
    assert.deepEqual(
      c.campaignPlan(discountJob).criteria,
      c.campaignCriteria(discounted.campaign.brief),
    );
    fixtures[0].metricMarketSpreadPct = 94.99;
    const rechecked = await generate(discounted);
    assert.equal(
      rechecked.proposal.data.slots.length,
      0,
      "regeneration respects changed benchmark evidence",
    );
    await server.setCampaignPaused(
      discounted.campaign.id,
      rechecked.campaign.revision,
      true,
    );
    // Remove this owned fixture before the remaining overlap tests.
    await db.marketingJob.deleteMany({
      where: { campaignId: discounted.campaign.id },
    });
    await db.marketingCampaignProposal.deleteMany({
      where: { campaignId: discounted.campaign.id },
    });
    await db.marketingCampaign.delete({
      where: { id: discounted.campaign.id },
    });
    for (let index = 0; index < original.length; index++)
      Object.assign(fixtures[index], original[index]);
    const extraTypes = ["GUDANG", "PABRIK", "TOKO", "HOTEL_DAN_VILLA"];
    for (const [index, type] of extraTypes.entries())
      fixtures[index + 20].propertyType = type;
    const extended = await generate(
      await create({
        ...brief("QA jenis tambahan"),
        propertyTypes: extraTypes,
        listingIds: fixtures.slice(20, 24).map((asset) => asset.id),
      }),
    );
    assert.deepEqual(extended.campaign.brief.propertyTypes, extraTypes);
    assert.deepEqual(
      new Set(
        extended.proposal.data.slots.map((slot) => slot.asset.propertyType),
      ),
      new Set(extraTypes),
    );
    for (let index = 20; index < 24; index++)
      fixtures[index].propertyType = "RUMAH";
    assert.deepEqual(
      found.recommendation.assets.map((asset) => asset.id),
      inventory.recommendation.assets.map((asset) => asset.id),
      "Searching must not narrow the recommendation pool",
    );
    let a = await generate(await create(brief("QA jadwal A"))),
      conflict = await generate(await create(brief("QA benturan")));
    assert.equal(a.proposal.data.slots.length, 6);
    assert.equal(a.proposal.data.target, 6);
    assert.equal(a.proposal.data.unfilled.length, 0);
    const editingStock = await server.campaignInventory({
      campaignId: a.campaign.id,
      criteria: c.campaignCriteria(a.campaign.brief),
      startDate: start,
      endDate: end,
      schedules: a.campaign.brief.schedules,
      listingIds: [],
      query: "",
      offset: 0,
    });
    assert.equal(editingStock.recommendation.filled, 4);
    assert.deepEqual(
      a.proposal.data.slots.map((s) => s.asset.id),
      brief("x").listingIds.slice(0, 6),
    );
    assert.deepEqual(
      a.proposal.data.slots.map((s) => new Date(s.scheduledFor).getUTCHours()),
      [1, 10, 1, 10, 1, 10],
    );
    // Existing regular automatic material yields to the explicit daily campaign schedule.
    const regular = await db.marketingJob.create({
      data: {
        scheduledFor: new Date(start + "T12:37:00+07:00"),
        settingsRevision: config.revision,
        plan: {},
        status: "queued",
        assetKey: "old-auto",
      },
    });
    extraJobs.push(regular.id);
    const stale = await db.marketingJob.create({
      data: {
        scheduledFor: new Date(a.proposal.data.slots[0].scheduledFor),
        settingsRevision: config.revision,
        plan: {},
        status: "queued",
        assetKey: "stale-auto",
        listingId: "1",
      },
    });
    extraJobs.push(stale.id);
    await db.marketingPublication.create({
      data: {
        jobId: stale.id,
        channel: "instagram",
        state: "preparing",
        attemptCount: 0,
        containerId: "stale-container",
      },
    });
    const revision = a.campaign.revision,
      proposalId = a.proposal.id;
    a = await apply(a);
    assert.equal(
      await db.marketingPublication.count({ where: { jobId: stale.id } }),
      0,
      "replacing regular material clears stale unattempted containers",
    );
    const replay = await server.approveCampaign(
      a.campaign.id,
      revision,
      proposalId,
    );
    assert.equal(replay.jobs.length, 6);
    assert.equal(
      (await db.marketingJob.findUniqueOrThrow({ where: { id: regular.id } }))
        .reason,
      "CAMPAIGN_SCHEDULE",
    );
    assert.deepEqual(
      (await periods.activeCampaignPeriods(start, end)).map(
        ({ startDate, endDate }) => ({ startDate, endDate }),
      ),
      [{ startDate: start, endDate: end }],
    );
    await assert.rejects(apply(conflict), (e) =>
      ["CAMPAIGN_SLOT_CONFLICT", "CAMPAIGN_REVIEW_REQUIRED"].includes(e.code),
    );
    assert.equal(
      await db.marketingJob.count({
        where: { campaignId: conflict.campaign.id },
      }),
      0,
    );
    conflict = await generate(conflict);
    assert.equal(conflict.proposal.data.slots.length, 0);
    assert.equal(conflict.proposal.data.unfilled.length, 6);
    let b = await generate(
      await create(
        brief("QA jadwal B", "Kabupaten Sidoarjo", ["10:20", "19:10"]),
      ),
    );
    b = await apply(b);
    assert.equal(
      new Set([...a.jobs, ...b.jobs].map((j) => j.scheduledFor)).size,
      12,
    );
    assert.ok(
      b.proposal.data.slots.every((s) => s.asset.city === "Kabupaten Sidoarjo"),
    );
    a = await server.setCampaignPaused(
      a.campaign.id,
      a.campaign.revision,
      true,
    );
    assert.ok(a.jobs.every((j) => j.status === "paused"));
    const oldRevision = a.campaign.revision;
    a = await server.setCampaignPaused(
      a.campaign.id,
      a.campaign.revision,
      false,
    );
    assert.ok(a.jobs.every((j) => j.status === "queued"));
    await assert.rejects(
      server.setCampaignPaused(a.campaign.id, oldRevision, true),
      (e) => e.code === "CAMPAIGN_CONFLICT",
    );
    a = await server.setCampaignPaused(
      a.campaign.id,
      a.campaign.revision,
      true,
    );
    const approved = (
      await db.marketingCampaign.findUniqueOrThrow({
        where: { id: a.campaign.id },
      })
    ).activeBrief;
    a = await server.saveCampaign({
      id: a.campaign.id,
      revision: a.campaign.revision,
      brief: { ...a.campaign.brief, endDate: start, schedules: ["08:15"] },
    });
    assert.deepEqual(
      (
        await db.marketingCampaign.findUniqueOrThrow({
          where: { id: a.campaign.id },
        })
      ).activeBrief,
      approved,
      "draft edit leaves live approved period alone",
    );
    a = await apply(await generate(a));
    assert.equal(a.campaign.state, "paused");
    assert.equal(a.campaign.planned, 1);
    assert.equal(a.proposal.version, 2);
    assert.equal(
      a.jobs.filter((j) => j.reason !== "CAMPAIGN_REPLACED").length,
      1,
    );
    // Too few selected assets: hold empty times without choosing unselected stock.
    fixtures[21].status = "TERJUAL";
    let sparse = await generate(
      await create({
        ...brief("QA stok kurang", "Kota Surabaya", ["11:11", "16:16"]),
        listingIds: [fixtures[20].id, fixtures[21].id],
      }),
    );
    assert.equal(sparse.proposal.data.slots.length, 1);
    assert.equal(sparse.proposal.data.unfilled.length, 5);
    assert.equal(sparse.proposal.data.stock, 1);
    const gap = sparse.proposal.data.unfilled[0];
    // Free the original slot by moving that selected asset to a previously empty time.
    sparse = await server.editCampaignSlot(
      sparse.campaign.id,
      sparse.campaign.revision,
      sparse.proposal.id,
      {
        slotId: sparse.proposal.data.slots[0].id,
        listingId: fixtures[20].id,
        scheduledFor: gap.scheduledFor,
      },
    );
    assert.equal(sparse.proposal.data.slots.length, 1);
    assert.equal(sparse.proposal.data.unfilled.length, 5);
    assert.equal(sparse.proposal.data.slots[0].scheduledFor, gap.scheduledFor);
    fixtures[21].status = "TERSEDIA";
    const empty = sparse.proposal.data.unfilled[0];
    sparse = await server.editCampaignSlot(
      sparse.campaign.id,
      sparse.campaign.revision,
      sparse.proposal.id,
      {
        slotId: empty.id,
        listingId: fixtures[21].id,
        scheduledFor: empty.scheduledFor,
      },
    );
    assert.equal(sparse.proposal.data.slots.length, 2);
    assert.equal(sparse.proposal.data.unfilled.length, 4);
    sparse = await apply(sparse);
    assert.equal(sparse.campaign.planned, 2);
    assert.equal(sparse.jobs.filter((j) => j.status === "skipped").length, 4);
    // The actual persisted Planner plan uses deadline + coverage, with no provider calls.
    const balancedSource = fixtures.slice(12, 18).map((item) => ({ ...item }));
    for (const [index, days] of [10, 11, 12, 13, 30, 40].entries())
      Object.assign(fixtures[12 + index], {
        listingCategory: "LELANG",
        auctionDate: new Date(
          Date.parse(start + "T07:27:00+07:00") + days * 86400000,
        ).toISOString(),
      });
    let balanced = await generate(
      await create({
        ...brief("QA H5 dan pemerataan", "Kota Surabaya", [
          "07:27",
          "11:27",
          "15:27",
          "17:27",
          "20:27",
        ]),
        assetOrder: "fresh",
        listingIds: fixtures.slice(12, 18).map((item) => item.id),
      }),
    );
    assert.deepEqual(
      balanced.proposal.data.slots.slice(0, 5).map((slot) => slot.asset.id),
      [
        fixtures[12].id,
        fixtures[13].id,
        fixtures[16].id,
        fixtures[14].id,
        fixtures[17].id,
      ],
    );
    assert.equal(
      balanced.proposal.data.policyVersion,
      load("src/lib/marketing/campaign-selection.ts").CAMPAIGN_POLICY_VERSION,
    );
    const currentPolicyData = balanced.proposal.data;
    await db.marketingCampaignProposal.update({
      where: { id: balanced.proposal.id },
      data: { data: { ...currentPolicyData, policyVersion: 0 } },
    });
    await assert.rejects(
      apply(balanced),
      (e) => e.code === "CAMPAIGN_POLICY_CHANGED",
    );
    await db.marketingCampaignProposal.update({
      where: { id: balanced.proposal.id },
      data: { data: currentPolicyData },
    });
    balanced = await apply(balanced);
    const planned = await runtime.plannerMonth(start.slice(0, 7));
    const fiveSessionJobs = await db.marketingJob.findMany({
      where: { campaignId: balanced.campaign.id },
    });
    assert.equal(fiveSessionJobs.length, 15);
    for (let offset = 0; offset < 3; offset++) {
      const day = d.jakartaDate(
        new Date(Date.parse(start + "T00:00:00+07:00") + offset * 86400000),
      );
      assert.equal(
        fiveSessionJobs.filter((job) => d.jakartaDate(job.scheduledFor) === day)
          .length,
        5,
      );
    }
    assert.equal(
      planned.campaignPeriods.find(
        (period) => period.plan?.id === balanced.campaign.id,
      ).plan.schedules.length,
      5,
    );
    const assigned = planned.jobs.filter(
      (job) => job.campaignId === balanced.campaign.id && job.plan.listingId,
    );
    assert.equal(assigned.length, balanced.proposal.data.slots.length);
    assert.ok(
      assigned.every(
        (job) =>
          job.snapshot.id === job.plan.listingId && job.plan.selectionReason,
      ),
    );
    assert.ok(
      assigned.every(
        (job) =>
          Date.parse(job.snapshot.auctionDate) - job.scheduledFor.getTime() >=
          5 * 86400000,
      ),
    );
    assert.equal(
      planned.pendingCampaigns.some((item) => item.id === balanced.campaign.id),
      false,
    );
    Object.assign(fixtures[12], balancedSource[0]);
    balancedSource.forEach((item, index) =>
      Object.assign(fixtures[12 + index], item),
    );
    // Persisted legacy lifecycle state must never revive an expired approved period.
    const historical = await generate(
      await create(brief("QA periode berakhir", "Kota Surabaya", ["07:37"])),
    );
    const pastBrief = {
      ...historical.campaign.brief,
      startDate: "2020-01-01",
      endDate: "2020-01-02",
    };
    await db.marketingCampaign.update({
      where: { id: historical.campaign.id },
      data: { state: "paused", brief: pastBrief, activeBrief: pastBrief },
    });
    const historicalRead = await server.getCampaign(historical.campaign.id);
    assert.equal(c.campaignStatus(historicalRead.campaign), "Berakhir");
    await assert.rejects(
      server.setCampaignPaused(
        historical.campaign.id,
        historicalRead.campaign.revision,
        false,
      ),
      (e) => e.code === "CAMPAIGN_ENDED",
    );
    await assert.rejects(
      server.generateCampaign(
        historical.campaign.id,
        historicalRead.campaign.revision,
      ),
      (e) => e.code === "CAMPAIGN_INVALID_PERIOD",
    );
    await assert.rejects(
      server.approveCampaign(
        historical.campaign.id,
        historicalRead.campaign.revision,
        historical.proposal.id,
      ),
      (e) => e.code === "CAMPAIGN_INVALID_PERIOD",
    );
    await assert.rejects(
      server.previewCampaignSlot(
        historical.campaign.id,
        historicalRead.campaign.revision,
        historical.proposal.id,
        historical.proposal.data.slots[0].id,
      ),
      (e) => e.code === "CAMPAIGN_INVALID_PERIOD",
    );
    assert.equal(
      await db.marketingJob.count({
        where: { campaignId: historical.campaign.id },
      }),
      0,
    );
    // Real persisted two-day queue; publication evidence below is a temporary DB fixture.
    {
      const originalSize = fixtures.length;
      const queuedFixtures = Array.from({ length: 20 }, (_, index) => ({
        ...fixtures[0],
        id: String(900000000000100000n + BigInt(index)),
        assetCode: "queue-qa-" + index,
        cityName: "Kota Batch QA",
        status: "TERSEDIA",
        listingCategory: "LELANG",
        metricMarketSpreadPct: 80,
        metricAuctionDropPct: 60,
        auctionDate: new Date(
          Date.parse(start + "T00:00:00+07:00") +
            (index < 12 ? 12 : 40) * 86400000,
        ).toISOString(),
      }));
      fixtures.push(...queuedFixtures);
      const times = ["06:11", "08:11", "10:11", "12:11", "16:11"];
      const input = {
        ...brief("QA antrean nyata dua hari", "Kota Batch QA", times),
        assetOrder: "fresh",
        listingIds: [],
      };
      const zero = new Date(start + "T00:00:00+07:00"),
        day2 = new Date(zero.getTime() + 86400000);
      let q = await create(input);
      q = await server.generateCampaign(q.campaign.id, q.campaign.revision, {
        queue: true,
        now: zero,
      });
      assert.equal(q.proposal.data.target, 10);
      assert.equal(q.proposal.data.slots.length, 10);
      q = await server.approveCampaign(
        q.campaign.id,
        q.campaign.revision,
        q.proposal.id,
        { queue: true, now: zero },
      );
      const firstQueue = await server.getCampaignQueue(q.campaign.id, zero);
      assert.equal(firstQueue.days.length, 2);
      assert.deepEqual(
        firstQueue.days.map((day) => day.slots.length),
        [5, 5],
      );
      let queueJobs = await db.marketingJob.findMany({
        where: { campaignId: q.campaign.id },
        orderBy: { scheduledFor: "asc" },
      });
      assert.equal(queueJobs.length, 10);
      const committed = queueJobs.slice(5).map((job) => ({
        id: job.id,
        assetKey: job.assetKey,
        when: job.scheduledFor.toISOString(),
      }));
      for (const job of queueJobs.slice(0, 5)) {
        await db.marketingJob.update({
          where: { id: job.id },
          data: { status: "completed" },
        });
        await db.marketingPublication.create({
          data: {
            id: randomUUID(),
            jobId: job.id,
            channel: input.channels[0],
            state: "published",
            publishedAt: job.scheduledFor,
            attemptCount: 1,
          },
        });
      }
      // A new matching property appears after creation; it must be available to the next batch.
      const added = {
        ...queuedFixtures[0],
        id: "900000000000100099",
        assetCode: "queue-qa-new",
        auctionDate: new Date(zero.getTime() + 8 * 86400000).toISOString(),
      };
      fixtures.push(added);
      assert.equal(
        await runtime.lease(() =>
          server.refreshCampaignQueues(day2, q.campaign.id),
        ),
        true,
      );
      const secondQueue = await server.getCampaignQueue(q.campaign.id, day2);
      assert.equal(secondQueue.days.length, 1);
      assert.equal(secondQueue.days[0].date, end);
      assert.equal(secondQueue.days[0].slots.length, 5);
      assert.equal(
        secondQueue.days[0].slots.filter((slot) => slot.asset).length,
        5,
      );
      assert.ok(
        secondQueue.days[0].slots.some((slot) => slot.asset.id === added.id),
      );
      queueJobs = await db.marketingJob.findMany({
        where: { campaignId: q.campaign.id, reason: null },
        orderBy: { scheduledFor: "asc" },
      });
      assert.equal(queueJobs.length, 15);
      assert.equal(new Set(queueJobs.map((job) => job.assetKey)).size, 15);
      assert.deepEqual(
        queueJobs.slice(5, 10).map((job) => ({
          id: job.id,
          assetKey: job.assetKey,
          when: job.scheduledFor.toISOString(),
        })),
        committed,
      );
      const signatures = JSON.stringify(queueJobs);
      assert.equal(
        await runtime.lease(() =>
          server.refreshCampaignQueues(
            new Date(day2.getTime() + 60000),
            q.campaign.id,
          ),
        ),
        false,
      );
      assert.equal(
        JSON.stringify(
          await db.marketingJob.findMany({
            where: { campaignId: q.campaign.id, reason: null },
            orderBy: { scheduledFor: "asc" },
          }),
        ),
        signatures,
      );
      // The future calendar retains all configured slots; only ready batches have assignments.
      const sourcePeriods = await periods.activeCampaignPeriods(start, end);
      assert.equal(
        sourcePeriods.find((period) => period.plan?.id === q.campaign.id).plan
          .preparedThrough,
        end,
      );
      assert.deepEqual(
        new Set(secondQueue.days[0].slots.map((slot) => slot.asset.assetKey)),
        new Set(queueJobs.slice(10).map((job) => job.assetKey)),
      );
      await db.marketingPublication.deleteMany({
        where: { job: { campaignId: q.campaign.id } },
      });
      fixtures.splice(originalSize);
    }
    // Paused batches have no publication evidence: their assignments must still
    // be unique, including slots whose time passed before the next refresh.
    {
      const originalSize = fixtures.length;
      const pausedFixtures = Array.from({ length: 20 }, (_, index) => ({
        ...fixtures[0],
        id: String(900000000000200000n + BigInt(index)),
        assetCode: "paused-queue-qa-" + index,
        cityName: "Kota Batch Jeda QA",
        listingCategory: "LELANG",
        metricMarketSpreadPct: 80,
        metricAuctionDropPct: 60,
        auctionDate: new Date(
          Date.parse(start + "T00:00:00+07:00") + 30 * 86400000,
        ).toISOString(),
      }));
      fixtures.push(...pausedFixtures);
      const input = {
        ...brief("QA batch dijeda tanpa kembar", "Kota Batch Jeda QA", [
          "06:13",
          "08:13",
          "10:13",
          "12:13",
          "16:13",
        ]),
        assetOrder: "fresh",
        listingIds: [],
      };
      const zero = new Date(start + "T00:00:00+07:00");
      const day2 = new Date(zero.getTime() + 86400000 + 9 * 3600000);
      let q = await create(input);
      q = await server.generateCampaign(q.campaign.id, q.campaign.revision, {
        queue: true,
        now: zero,
      });
      // Recheck reservations created after generation, including legacy plan
      // IDs outside both the cooldown and the campaign's job query window.
      const claimed = q.proposal.data.slots[0].asset;
      const lateReservation = await db.marketingJob.create({
        data: {
          scheduledFor: new Date(zero.getTime() + 120 * 86400000 + 127000),
          status: "paused",
          assetKey: "old-reservation-identity-" + randomUUID(),
          snapshot: {},
          plan: {
            kind: "manual",
            listingId: claimed.id,
            channels: input.channels,
          },
          settingsRevision: config.revision,
        },
      });
      extraJobs.push(lateReservation.id);
      await assert.rejects(
        server.approveCampaign(
          q.campaign.id,
          q.campaign.revision,
          q.proposal.id,
          { queue: true, now: zero },
        ),
        (error) => error.code === "CAMPAIGN_REVIEW_REQUIRED",
      );
      await db.marketingJob.delete({ where: { id: lateReservation.id } });
      q = await server.approveCampaign(
        q.campaign.id,
        q.campaign.revision,
        q.proposal.id,
        { queue: true, now: zero },
      );
      q = await server.setCampaignPaused(
        q.campaign.id,
        q.campaign.revision,
        true,
      );
      const firstJobs = await db.marketingJob.findMany({
        where: { campaignId: q.campaign.id },
        orderBy: { scheduledFor: "asc" },
      });
      assert.equal(firstJobs.length, 10);
      assert.equal(
        await db.marketingPublication.count({
          where: { job: { campaignId: q.campaign.id } },
        }),
        0,
      );
      await runtime.lease(() =>
        server.refreshCampaignQueues(day2, q.campaign.id, true),
      );
      let jobs = await db.marketingJob.findMany({
        where: { campaignId: q.campaign.id },
        orderBy: { scheduledFor: "asc" },
      });
      assert.equal(jobs.length, 15);
      assert.equal(
        new Set(jobs.map((job) => job.assetKey)).size,
        15,
        "Paused prior batches must not donate their assets to the next batch",
      );
      assert.deepEqual(
        jobs.slice(0, 10).map((job) => [job.id, job.assetKey]),
        firstJobs.map((job) => [job.id, job.assetKey]),
      );
      // Reproduce a pre-fix duplicate already stored in the next batch.
      await db.marketingJob.update({
        where: { id: jobs[10].id },
        data: {
          assetKey: jobs[0].assetKey,
          snapshot: jobs[0].snapshot,
          plan: { ...jobs[10].plan, listingId: jobs[0].snapshot.id },
        },
      });
      await runtime.lease(() =>
        server.refreshCampaignQueues(
          new Date(day2.getTime() + 60000),
          q.campaign.id,
          true,
        ),
      );
      jobs = await db.marketingJob.findMany({
        where: { campaignId: q.campaign.id },
        orderBy: { scheduledFor: "asc" },
      });
      assert.equal(
        new Set(jobs.map((job) => job.assetKey)).size,
        15,
        "Refresh must repair an existing duplicate, preserving the earlier assignment",
      );
      assert.deepEqual(
        jobs.slice(0, 10).map((job) => [job.id, job.assetKey]),
        firstJobs.map((job) => [job.id, job.assetKey]),
      );
      assert.ok(jobs.every((job) => job.status === "paused"));
      // A source-ID alias in an old snapshot must still block lifetime reuse.
      const remaining = pausedFixtures.find(
        (item) => !jobs.some((job) => job.snapshot.id === item.id),
      );
      const oldJob = await db.marketingJob.create({
        data: {
          scheduledFor: new Date(zero.getTime() - 200 * 86400000 + 123000),
          status: "completed",
          assetKey: "legacy-identity-" + randomUUID(),
          snapshot: { id: remaining.id },
          settingsRevision: config.revision,
        },
      });
      extraJobs.push(oldJob.id);
      await db.marketingPublication.create({
        data: {
          jobId: oldJob.id,
          channel: "instagram",
          state: "published",
          attemptCount: 1,
          publishedAt: oldJob.scheduledFor,
        },
      });
      const dedup = createLoader({ "@/lib/prisma": db })(
        "src/lib/marketing/campaign-dedup.server.ts",
      );
      assert.ok(
        (await dedup.marketedAssetKeys([d.snapshotAsset(remaining)])).has(
          d.assetIdentity(remaining),
        ),
        "An old snapshot-only publication must block the source's new identity",
      );
      await db.marketingPublication.deleteMany({ where: { jobId: oldJob.id } });
      fixtures.splice(originalSize);
    }
    assert.equal(
      await db.marketingPublication.count({ where: { state: "published" } }),
      published,
    );
    assert.equal(
      (
        await db.marketingSettings.findUniqueOrThrow({
          where: { id: "company" },
        })
      ).enabled,
      false,
    );
    console.log(
      JSON.stringify({
        passed: true,
        checks: [
          "current/ended filtering before independent pagination, approved period, legacy fallback, WIB midnight, page clamping",
          "filtered/paginated asset selection",
          "empty draft saves and updates without proposals or Planner jobs",
          "per-campaign market/auction/OR percentage thresholds",
          "discount criteria persisted in approved Planner jobs",
          "changed benchmark evidence blocks approval and regeneration",
          "five saved sessions per day project fifteen draft slots without execution jobs",
          "five-session approved plan persists all fifteen daily times WIB",
          "H5 deadline and coverage allocation persist as real Planner property IDs",
          "old-policy proposals require regeneration",
          "synced campaigns disappear from pending notices",
          "selected asset rotation",
          "two campaigns custom times",
          "approval replay",
          "conflict rollback",
          "regular automatic suppression",
          "immutable approved settings",
          "expired period cannot resume, generate, approve, or render new previews",
          "pause/resume",
          "paused future revision",
          "stock shortage held",
          "move to empty time",
          "two-day live queue, early next-batch preparation, odd final day, preserved committed jobs and newly ingested stock",
          "lifetime publication exclusion and no duplicate parcel across batches",
          "unattempted paused batches, elapsed sessions, existing-duplicate repair and snapshot-only historical publication aliases",
          "zero dispatch",
        ],
      }),
    );
  } finally {
    const jobs = await db.marketingJob.findMany({
      where: { OR: [{ campaignId: { in: ids } }, { id: { in: extraJobs } }] },
      select: { id: true },
    });
    await db.marketingPublication.deleteMany({
      where: { jobId: { in: jobs.map((j) => j.id) } },
    });
    await db.marketingJob.deleteMany({
      where: { id: { in: jobs.map((j) => j.id) } },
    });
    await db.marketingCampaignProposal.deleteMany({
      where: { campaignId: { in: ids } },
    });
    await db.marketingCampaign.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(
    e.code || "",
    e.message,
    e.code === "ERR_ASSERTION" ? e.stack : "",
  );
  process.exitCode = 1;
});
