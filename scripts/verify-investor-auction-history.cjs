/** READ ONLY: compare Investor against the actual Riwayat Lelang Aset engine. */
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config({ quiet: true });
const client = new PrismaClient();
(async () => {
  try {
    await client.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        const load = require("./lib/investor-test-loader.cjs")({
          "@/lib/investor-read.server": {
            withInvestorRead: (callback) => callback(tx),
          },
          "@/lib/prisma": {
            $queryRaw: (...q) => tx.$queryRaw(...q),
            $transaction: async (cb) => cb(tx),
          },
        });
        const { getAuctionHistory } = load("src/lib/auctionHistory.ts");
        const { getInvestorFeed, getCmaValidationProof } = load(
          "src/lib/investor-deals.server.ts",
        );
        const filters = {
          city: "Kota Surabaya",
          query: "",
          sort: "drop",
          minDrop: 25,
          minSpread: 25,
          savedOnly: false,
          upcomingOnly: false,
        };
        const example = await getInvestorFeed(
          { ...filters, savedOnly: true, dataState: "all" },
          1,
          "grid",
          ["64493"],
          true,
        );
        assert.equal(example.items.length, 1);
        assert.equal(example.items[0].initialAuctionPrice, 306e6);
        assert.equal(example.items[0].currentAuctionPrice, 306e6);
        assert.equal(example.items[0].metricAuctionDropPct, 0);
        const proof = await getCmaValidationProof("64493");
        assert.equal(proof.listing.metricAuctionDropPct, 0);
        assert.ok(
          proof.listing.auctionHistoryPoints.some(
            (p) => p.sourceListingId === "54948" && p.price === 306e6,
          ),
        );
        const feed = await getInvestorFeed(filters, 1, "grid", []);
        let checked = 0;
        for (const item of feed.items) {
          const history = await getAuctionHistory(item.id);
          const same = history.items.filter((p) => p.cakupan === "SAMA");
          const currentIndex = same.findIndex((p) => p.is_current);
          const points = same
            .slice(0, currentIndex + 1)
            .filter((p) => p.harga_efektif > 0);
          const expected =
            points.length >= 2
              ? ((points[0].harga_efektif - points.at(-1).harga_efektif) /
                  points[0].harga_efektif) *
                100
              : null;
          assert.equal(item.metricAuctionDropPct, expected);
          if (expected !== null)
            assert.equal(item.initialAuctionPrice, points[0].harga_efektif);
          checked++;
        }
        assert.ok(
          feed.items.every(
            (v, i) =>
              !i ||
              feed.items[i - 1].metricAuctionDropPct >= v.metricAuctionDropPct,
          ),
        );
        console.log(
          JSON.stringify({
            screenshotAsset: "64493",
            history: ["54948", "64493"],
            initial: 306e6,
            current: 306e6,
            dropPct: 0,
            rankedListingsChecked: checked,
            cityDeals: feed.total,
            source: "actual Riwayat Lelang Aset; READ ONLY",
          }),
        );
      },
      { timeout: 120000 },
    );
  } finally {
    await client.$disconnect();
  }
})().catch((e) => {
  console.error(
    e.name,
    e.code || "",
    String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]"),
  );
  process.exitCode = 1;
});
