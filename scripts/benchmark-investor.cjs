/** Read-only core timing; no credentials, property addresses or owner identifiers logged. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const client = new PrismaClient();
const nativeLoad = require("./lib/investor-test-loader.cjs")();
const native =
  process.env.INVESTOR_BENCH_DRIVER === "pg"
    ? nativeLoad("src/lib/investor-read.server.ts")
    : null;
let reader;
const timings = [];
const bridge = { $transaction: async (cb) => cb(reader) };
const load = require("./lib/investor-test-loader.cjs")({
  "@/lib/prisma": bridge,
  "@/lib/investor-read.server": {
    withInvestorRead: (callback) => callback(reader),
  },
});
const { getInvestorFeed } = load("src/lib/investor-deals.server.ts");
const filters = {
  transactionType: "BELI",
  listingCategory: "ALL",
  dataState: "all",
  city: process.env.INVESTOR_BENCH_NATIONAL === "1" ? "" : "Kota Surabaya",
  query: "",
  minSpread: 25,
  minDrop: 25,
  sort: "score",
  savedOnly: false,
  upcomingOnly: false,
};
(async () => {
  try {
    const run = native
      ? (callback) => native.withInvestorRead(callback)
      : (callback) =>
          client.$transaction(callback, {
            timeout: 120000,
            isolationLevel: "RepeatableRead",
          });
    const results = await run(async (tx) => {
      if (!native) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      reader = {
        $queryRaw: async (sql, ...args) => {
          const text = Array.isArray(sql) ? sql.join("?") : sql.sql;
          const label = text.includes("SELECT DISTINCT provinsi,kota")
            ? "regions"
            : text.includes("to_regclass") || text.includes("SELECT version")
              ? "readiness"
              : text.includes("SELECT id_property::text id,gambar")
                ? "visible photos"
                : text.includes("ORDER BY id_property") &&
                    !text.includes("WITH aliases")
                  ? "history"
                  : text.includes("set_config")
                    ? "timeout"
                    : "CMA";
          const start = performance.now();
          const result = await tx.$queryRaw(sql, ...args);
          timings.push({
            phase,
            label,
            ms: Math.round(performance.now() - start),
            rows: result.length,
          });
          return result;
        },
      };
      const measurements = [];
      let data;
      for (const [name, patch, page] of [
        ["cold", {}, 1],
        ["warm", {}, 1],
        ["page2", {}, 2],
        ["spread", { sort: "spread" }, 1],
        ["drop", { sort: "drop" }, 1],
        ["repeat", { sort: "spread" }, 1],
      ]) {
        phase = name;
        const start = performance.now();
        data = await getInvestorFeed(
          { ...filters, ...patch },
          page,
          "grid",
          [],
          name === "cold",
        );
        assert.ok(data.items.length > 0);
        assert.ok(
          data.items.every(
            (item) => !item.benchmark || item.benchmark.scope === "KELURAHAN",
          ),
        );
        const metric =
          patch.sort === "spread"
            ? "metricMarketSpreadPct"
            : patch.sort === "drop"
              ? "metricAuctionDropPct"
              : "primaryDealScore";
        assert.ok(
          data.items.every(
            (item, index, items) =>
              index === 0 ||
              (items[index - 1][metric] ?? -Infinity) >=
                (item[metric] ?? -Infinity),
          ),
        );
        measurements.push({
          phase: name,
          ms: Math.round(performance.now() - start),
          queries: timings.filter((t) => t.phase === name).length,
          payloadKB: Math.round(Buffer.byteLength(JSON.stringify(data)) / 1024),
        });
      }
      return {
        scope: filters.city || "national",
        reader: native ? "pg" : "prisma",
        measurements,
        queryTimings: timings,
        activeAssets: data.summary.activeListings,
        rankedDeals: data.summary.worthItCount,
      };
    });
    if (process.env.INVESTOR_BENCH_OUTPUT)
      fs.writeFileSync(
        process.env.INVESTOR_BENCH_OUTPUT,
        JSON.stringify(results, null, 2),
      );
    console.log(JSON.stringify(results));
  } finally {
    await client.$disconnect();
    if (native) await native.closeInvestorReadPool();
  }
})().catch((e) => {
  console.error(e.name);
  process.exitCode = 1;
});
let phase = "";
