/** Owner isolation, bounded age, revalidation cache and request cancellation. */
const assert = require("node:assert/strict");
const load = require("./lib/investor-test-loader.cjs")();
const { InvestorFeedCache, acquireInvestorFeed } = load(
  "src/lib/investor-feed-cache.ts",
);
const data = {
  items: [{ id: "1", benchmark: { scope: "KELURAHAN" } }],
  summary: {},
  cities: [],
  total: 1,
};
const records = new Map();
const storage = {
  getItem: (key) => records.get(key) ?? null,
  setItem: (key, value) => records.set(key, value),
  removeItem: (key) => records.delete(key),
};
let now = 1000;
const cache = new InvestorFeedCache(
  () => storage,
  () => now,
);
cache.write("owner-a", "buy", data);
assert.equal(cache.read("owner-a", "buy"), data);
assert.equal(cache.read("owner-b", "buy"), null);
assert.equal(cache.read("owner-a", "rent"), null);
const restored = new InvestorFeedCache(
  () => storage,
  () => now,
);
assert.equal(restored.read("owner-a", "buy").items[0].id, "1");
assert.equal(records.size, 1, "Only latest response persisted per owner");
now += 60000;
assert.equal(cache.read("owner-a", "buy"), null);
assert.equal(restored.read("owner-a", "buy"), null);
cache.write("owner-a", "buy", data);
cache.clear("owner-a");
assert.equal(cache.read("owner-a", "buy"), null);
assert.equal(records.size, 0);
cache.write("owner-a", "old-policy", {
  ...data,
  items: [{ benchmark: { scope: "KECAMATAN" } }],
});
assert.equal(cache.read("owner-a", "old-policy"), null);
for (let i = 0; i < 9; i++) cache.write("owner-a", `page${i}`, data);
assert.equal(cache.read("owner-a", "page0"), null, "Bound in-memory responses");
const unavailable = new InvestorFeedCache(
  () => {
    throw new Error("Storage unavailable");
  },
  () => now,
);
unavailable.write("owner", "buy", data);
assert.equal(unavailable.read("owner", "buy"), data);
unavailable.clear("owner");
const defer = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
(async () => {
  const done = defer();
  let calls = 0;
  const fetcher = () => {
    calls++;
    return done.promise;
  };
  const first = acquireInvestorFeed("owner", "same", false, fetcher);
  first.release(); // React StrictMode detach + immediate resubscribe.
  const second = acquireInvestorFeed("owner", "same", false, fetcher);
  await Promise.resolve();
  assert.equal(calls, 1);
  done.resolve(data);
  assert.equal(await second.promise, data);
  first.release();
  second.release();
  let aborted = false;
  const abandoned = acquireInvestorFeed(
    "owner",
    "obsolete",
    false,
    (signal) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        }),
      ),
  );
  const caught = abandoned.promise.catch((e) => e.message);
  abandoned.release();
  assert.equal(await caught, "aborted");
  assert.equal(aborted, true);
  const normal = defer(),
    forced = defer();
  const a = acquireInvestorFeed(
    "owner",
    "refresh",
    false,
    () => normal.promise,
  );
  const b = acquireInvestorFeed("owner", "refresh", true, () => forced.promise);
  assert.notEqual(
    a.promise,
    b.promise,
    "Manual refresh must not reuse an ordinary pending read",
  );
  normal.resolve(data);
  forced.resolve(data);
  await Promise.all([a.promise, b.promise]);
  a.release();
  b.release();
  console.log(
    "Investor browser cache passed: owner/transaction isolation, 60s expiry, version rejection, bounded storage, unavailable storage, StrictMode deduplication, obsolete-search abort and explicit refresh.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
