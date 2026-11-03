/** Read-only integration checks against the configured listing database. */
const assert = require("node:assert/strict");
require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const createLoader = require("./lib/investor-test-loader.cjs");
const client = new PrismaClient();
let transaction;
const bridge = { $transaction: async (callback) => callback(transaction) };
const load = createLoader({
  "@/lib/prisma": bridge,
  "@/lib/investor-read.server": {
    withInvestorRead: (callback) => callback(transaction),
  },
});
const { getInvestorFeed, getCmaValidationProof } = load(
  "src/lib/investor-deals.server.ts",
);
const { isWorthItDeal } = load("src/lib/investor-deals.ts");
(async () => {
  try {
    await client.$transaction(
      async (tx) => {
        transaction = tx;
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const filters = {
          dataState: "deals",
          city: "Kota Surabaya",
          query: "",
          minSpread: 25,
          minDrop: 25,
          sort: "score",
          savedOnly: false,
          upcomingOnly: false,
        };
        const start = Date.now();
        const first = await getInvestorFeed(filters, 1, "grid", [], true);
        assert.equal(first.pageSize, 30);
        assert.equal(first.items.length, Math.min(30, first.total));
        assert.ok(first.cities.length > 0);
        for (const item of first.items) {
          assert.ok(/^\d+$/.test(item.id));
          assert.ok(isWorthItDeal(item, 25, 25));
          assert.equal(
            item.primaryDealScore,
            [item.metricAuctionDropPct, item.metricMarketSpreadPct]
              .filter((value) => value !== null)
              .reduce((sum, value) => sum + value, 0),
          );
          if (item.landAreaSqm)
            assert.ok(
              Math.abs(
                item.pricePerSqm - item.currentAuctionPrice / item.landAreaSqm,
              ) < 1e-6,
            );
          if (item.metricAuctionDropPct !== null)
            assert.ok(
              Math.abs(
                item.metricAuctionDropPct -
                  ((item.initialAuctionPrice - item.currentAuctionPrice) /
                    item.initialAuctionPrice) *
                    100,
              ) < 1e-9,
            );
          if (item.benchmark) assert.ok(item.benchmark.sampleCount > 0);
        }
        if (first.items[0]) {
          const proof = await getCmaValidationProof(first.items[0].id);
          assert.ok(proof.samples.length <= 10);
          assert.ok(
            proof.samples.every(
              (p) =>
                p.assetCode !== proof.listing.assetCode &&
                p.propertyType === proof.listing.propertyType,
            ),
          );
          assert.equal(
            proof.benchmark?.sampleCount ?? 0,
            proof.listing.benchmark?.sampleCount ?? 0,
          );
        }
        assert.ok(
          first.items.every(
            (item, index) =>
              index === 0 ||
              first.items[index - 1].primaryDealScore >= item.primaryDealScore,
          ),
        );
        if (first.pageCount > 1) {
          const second = await getInvestorFeed(filters, 2, "grid", []);
          assert.ok(
            second.items.every(
              (item) =>
                !first.items.some((previous) => previous.id === item.id),
            ),
          );
          assert.ok(
            second.items.every(
              (item) =>
                item.primaryDealScore <= first.items.at(-1).primaryDealScore,
            ),
          );
        }
        const last = await getInvestorFeed(filters, 999999, "table", []);
        assert.equal(last.page, last.pageCount);
        if (first.items[0]) {
          const saved = await getInvestorFeed(
            { ...filters, savedOnly: true },
            1,
            "grid",
            [first.items[0].id],
          );
          assert.equal(saved.total, 1);
          assert.equal(saved.items[0].id, first.items[0].id);
        }
        console.log(
          JSON.stringify({
            scope: "Surabaya",
            elapsedMs: Date.now() - start,
            activeAssets: first.summary.activeListings,
            rankedDeals: first.total,
            historyCoverage: first.summary.historyCoverage,
            marketCoverage: first.summary.benchmarkCoverage,
            cities: first.cities.length,
          }),
        );
        const nationalStart = Date.now();
        const national = await getInvestorFeed(
          { ...filters, city: "" },
          1,
          "map",
          [],
          true,
        );
        assert.ok(
          national.items.length <= 200 && national.total >= first.total,
        );
        assert.ok(
          national.items.every(
            (item, index) =>
              index === 0 ||
              national.items[index - 1].primaryDealScore >=
                item.primaryDealScore,
          ),
        );
        assert.ok(
          national.summary.topDeal?.primaryDealScore >=
            (first.summary.topDeal?.primaryDealScore ?? 0),
        );
        console.log(
          JSON.stringify({
            scope: "National",
            elapsedMs: Date.now() - nationalStart,
            activeAssets: national.summary.activeListings,
            rankedDeals: national.total,
            mapRows: national.items.length,
            topScore: national.summary.topDeal?.primaryDealScore ?? null,
          }),
        );
      },
      { isolationLevel: "RepeatableRead", timeout: 180000, maxWait: 10000 },
    );
    console.log(
      "Live database verification passed in a READ ONLY transaction; no listing was created or modified.",
    );
  } finally {
    await client.$disconnect();
  }
})().catch((error) => {
  console.error(
    error.name,
    error.code || "",
    error.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]"),
  );
  process.exitCode = 1;
});
