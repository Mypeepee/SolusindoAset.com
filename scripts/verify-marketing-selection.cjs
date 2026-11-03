// Read-only integration with the real Investor engine and original source photos.
const assert = require("node:assert/strict");
require("dotenv").config({ quiet: true });
const createLoader = require("./lib/marketing-test-loader.cjs");
const load = createLoader({ "@/lib/prisma": {} });
const domain = load("src/lib/marketing/domain.ts");
const { withInvestorRead, closeInvestorReadPool } = load(
  "src/lib/investor-read.server.ts",
);
const { getMarketingInvestorCandidates } = load(
  "src/lib/investor-cma-legacy.server.ts",
);
(async () => {
  try {
    const result = await withInvestorRead(async (reader) => {
      const batch = await getMarketingInvestorCandidates(
        reader,
        domain.investorFilters(domain.DEFAULT_CONFIG),
        new Set(),
        0,
        30,
        (item) => domain.eligibleAsset(item, domain.DEFAULT_CONFIG),
      );
      if (batch.items.length) {
        const id = batch.items[0].id;
        const { Prisma } = require("@prisma/client");
        const [source] = await reader.$queryRaw(
          Prisma.sql`SELECT gambar FROM listing WHERE id_property=${BigInt(id)}`,
        );
        const originals = new Set(
          (source.gambar || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        );
        for (const photo of batch.items[0].imageUrls)
          assert.ok(
            originals.has(photo),
            "Publishing must use genuine source references",
          );
      }
      for (let i = 1; i < batch.items.length; i++)
        assert.ok(
          (batch.items[i - 1].primaryDealScore ?? -Infinity) >=
            (batch.items[i].primaryDealScore ?? -Infinity),
        );
      return {
        total: batch.total,
        batchSize: batch.items.length,
        withPhotos: batch.items.filter((item) => item.imageUrls.length).length,
        eligibleNow: batch.items.filter((item) =>
          domain.eligibleAsset(item, domain.DEFAULT_CONFIG),
        ).length,
      };
    });
    console.log(JSON.stringify({ passed: true, readOnly: true, ...result }));
  } finally {
    await closeInvestorReadPool();
  }
})().catch((error) => {
  console.error(
    "Marketing selection verification:",
    error.code || error.name,
    error.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]"),
  );
  process.exitCode = 1;
});
