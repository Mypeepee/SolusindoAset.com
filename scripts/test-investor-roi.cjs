/** Financial regression tests for the approved Investor simulation policy. */
const assert = require("node:assert/strict");
const load = require("./lib/investor-test-loader.cjs")();
const {
  calculatePurchase,
  defaultPurchaseAssumptions,
  calculateResaleScenario,
  selectCmaEvidence,
} = load("src/lib/investor-roi.ts");
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const auction = calculatePurchase(
  defaultPurchaseAssumptions(1e9, "LELANG"),
  "LELANG",
);
assert.equal(auction.documents, 85e6);
assert.equal(auction.eviction, 135e6);
assert.equal(auction.total, 1.22e9);
assert.equal(auction.fees.length, 4);
for (const category of ["PRIMARY", "SECONDARY"]) {
  const result = calculatePurchase(
    defaultPurchaseAssumptions(1e9, category),
    category,
  );
  assert.equal(result.total, 1.055e9);
  assert.equal(result.documents, 55e6);
  assert.equal(result.eviction, 0);
  assert.deepEqual(
    Array.from(result.fees, (f) => f.code),
    ["bphtb", "ajb"],
  );
}
const win = calculateResaleScenario(auction.total, 15e6, 100);
assert.equal(win.resalePrice, 1.5e9);
assert.equal(win.profit, 280e6);
near(win.roi, (280e6 / 1.22e9) * 100);
assert.equal(calculateResaleScenario(auction.total, 12.2e6, 100).roi, 0);
const loss = calculateResaleScenario(auction.total, 10e6, 100);
assert.equal(loss.profit, -220e6);
near(loss.roi, (-220e6 / 1.22e9) * 100);
assert.equal(calculateResaleScenario(auction.total, null, 100), null);
assert.equal(calculateResaleScenario(auction.total, 10e6, null), null);
assert.equal(calculateResaleScenario(auction.total, 10e6, 0), null);
for (const price of [NaN, Infinity, 0, -1, 1.2, Number.MAX_SAFE_INTEGER])
  assert.equal(
    calculatePurchase(defaultPurchaseAssumptions(price, "LELANG"), "LELANG"),
    null,
  );
const edited = defaultPurchaseAssumptions(1e9, "LELANG");
edited.eviction = 0;
edited.rates.ppn_lelang = 0;
assert.equal(calculatePurchase(edited, "LELANG").total, 1.074e9);
edited.rates.bphtb = 101;
assert.equal(calculatePurchase(edited, "LELANG"), null);
edited.rates.bphtb = 0.123;
assert.equal(calculatePurchase(edited, "LELANG"), null);
// Half-Rupiah rounds upward; sum the rounded line amounts, not an aggregate rate.
const rounded = calculatePurchase(
  defaultPurchaseAssumptions(125, "LELANG"),
  "LELANG",
);
assert.equal(rounded.fees.find((f) => f.code === "roya_balik_nama").amount, 1);
assert.equal(
  rounded.total,
  125 + rounded.fees.reduce((s, f) => s + f.amount, 0) + 135e6,
);
const peers = Array.from({ length: 14 }, (_, i) => ({
  assetCode: `peer-${i}`,
  baselinePricePerSqm: (i + 1) * 1e6,
  updatedAt: "2026-10-25",
}));
const target = {
  assetCode: "target",
  baselinePricePerSqm: 1,
  updatedAt: "2026-10-25",
};
const projection = selectCmaEvidence([...peers, target], "target");
assert.equal(projection.samples.length, 9);
assert.equal(projection.samples[0].baselinePricePerSqm, 14e6);
assert.equal(projection.samples[8].baselinePricePerSqm, 6e6);
assert.equal(projection.minBaselinePricePerSqm, 1e6);
assert.equal(projection.cheapestPeer.assetCode, "peer-0");
assert.ok(!projection.samples.includes(projection.cheapestPeer));
assert.equal(peers[0].baselinePricePerSqm, 1e6, "Do not mutate full peer pool");
assert.equal(
  selectCmaEvidence([target], "target").minBaselinePricePerSqm,
  null,
);
console.log(
  "Investor ROI passed: auction 1.22B, Primary/Secondary 1.055B, rounded IDR components, profit/loss/breakeven on acquisition total, invalid inputs, local overrides, top-nine evidence and full-pool minimum excluding target.",
);
