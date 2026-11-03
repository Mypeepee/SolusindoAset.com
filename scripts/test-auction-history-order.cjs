// Fixture regressions; no database reads or writes.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const createLoader = require("./lib/investor-test-loader.cjs");
const load = createLoader({ "@/lib/prisma": {} });
const { assembleAuctionHistory } = load("src/lib/auctionHistory.ts");
const { compareAuctionHistoryDates, orderAuctionHistoryItems } = load(
  "src/lib/auctionHistoryOrder.ts",
);

const source = (id, date, price, extra = {}) => ({
  id_property: BigInt(id),
  judul: "Fixture riwayat lelang",
  slug: "fixture-riwayat",
  jenis_transaksi: "LELANG",
  status_tayang: "TERSEDIA",
  kota: "Kab. Sidoarjo",
  kecamatan: "Sidoarjo",
  kelurahan: "Fixture",
  legalitas: "SHM",
  nomor_legalitas: "2466",
  luas_tanah: 57,
  harga: price,
  nilai_limit_lelang: price,
  tanggal_lelang: date ? new Date(date) : null,
  tanggal_dibuat: new Date("2024-01-01"),
  ...extra,
});
const timeline = (id, date, price, extra = {}) => ({
  id_property: String(id),
  tanggal_lelang: date,
  harga_efektif: price,
  cakupan: "SAMA",
  is_current: String(id) === "185768",
  urutan: 99,
  delta_persen: 125,
  ...extra,
});
const ids = (items) => Array.from(items, (item) => item.id_property);
const screenshotItems = () => [
  timeline(174901, "2026-10-12T10:00:00+07:00", 450e6),
  timeline(185768, "2026-10-28T10:00:00+07:00", 200e6),
  timeline(173010, "2026-09-07T10:00:00+07:00", 450e6),
];

test("collector sorts by auction dates despite conflicting IDs and creation dates", () => {
  const current = source(185768, "2026-10-28", 200e6);
  const candidates = [
    source(174901, "2026-10-12", 450e6),
    source(173010, "2026-09-07", 450e6, {
      tanggal_dibuat: new Date("2026-10-30"),
    }),
  ];
  const history = assembleAuctionHistory(current, candidates);
  assert.deepEqual(
    Array.from(history, (entry) => String(entry.row.id_property)),
    ["173010", "174901", "185768"],
  );
});

test("displayed rounds and deltas follow dates, preserving input and current listing", () => {
  const input = screenshotItems();
  const before = JSON.stringify(input);
  const sorted = orderAuctionHistoryItems(input);
  assert.deepEqual(ids(sorted), ["173010", "174901", "185768"]);
  assert.deepEqual(Array.from(sorted, (item) => item.urutan), [1, 2, 3]);
  assert.equal(sorted[0].delta_persen, null);
  assert.equal(sorted[1].delta_persen, 0);
  assert.ok(Math.abs(sorted[2].delta_persen - (-250 / 450) * 100) < 1e-10);
  assert.equal(sorted[2].is_current, true);
  assert.equal(JSON.stringify(input), before);
});

test("real future years are preserved rather than inferred from the current listing", () => {
  const items = screenshotItems();
  items[2].tanggal_lelang = "2027-09-07T10:00:00+07:00";
  const sorted = orderAuctionHistoryItems(items);
  assert.deepEqual(ids(sorted), ["174901", "185768", "173010"]);
  assert.equal(sorted[2].tanggal_lelang, "2027-09-07T10:00:00+07:00");
});

test("missing dates follow known dates even when the listing was created earlier", () => {
  const current = source(3, "2026-10-28", 200e6);
  const history = assembleAuctionHistory(current, [
    source(1, null, 450e6),
    source(2, "2026-09-07", 450e6),
  ]);
  assert.deepEqual(
    Array.from(history, (entry) => String(entry.row.id_property)),
    ["2", "3", "1"],
  );
  assert.deepEqual(
    ids(orderAuctionHistoryItems([
      timeline(1, "invalid", 450e6),
      timeline(3, "2026-10-28", 200e6),
      timeline(2, null, 450e6),
    ])),
    ["3", "1", "2"],
  );
});

test("equal timestamps have a stable ID tie-breaker, without preferring the open listing", () => {
  const laterId = timeline("90071992547409930002", "2026-10-28", 200e6);
  const earlierId = timeline("90071992547409930001", "2026-10-28", 450e6);
  assert.equal(compareAuctionHistoryDates(laterId, earlierId), 1);
  assert.equal(compareAuctionHistoryDates(earlierId, laterId), -1);
  assert.equal(compareAuctionHistoryDates(earlierId, earlierId), 0);
});

test("different parcel scopes and unavailable prices do not enter price comparisons", () => {
  const sorted = orderAuctionHistoryItems([
    timeline(5, "2026-10-28", 200e6),
    timeline(4, "2026-10-20", Infinity),
    timeline(3, "2026-10-12", null),
    timeline(2, "2026-10-01", 1e9, { cakupan: "LEBIH_LUAS" }),
    timeline(1, "2026-09-07", 450e6),
  ]);
  for (const item of sorted.slice(0, -1)) assert.equal(item.delta_persen, null);
  assert.ok(Math.abs(sorted[4].delta_persen - (-250 / 450) * 100) < 1e-10);
  assert.equal(orderAuctionHistoryItems([]).length, 0);
});

test("detail service returns chronological rounds and deltas", async () => {
  const current = source(185768, "2026-10-28", 200e6);
  const candidates = [
    source(174901, "2026-10-12", 450e6),
    source(173010, "2026-09-07", 450e6),
  ];
  let queries = 0;
  const serviceLoad = createLoader({
    "@/lib/prisma": { $queryRaw: async () => (++queries === 1 ? [current] : candidates) },
  });
  const { getAuctionHistory } = serviceLoad("src/lib/auctionHistory.ts");
  const history = await getAuctionHistory("185768");
  assert.deepEqual(ids(history.items), ["173010", "174901", "185768"]);
  assert.equal(history.items[2].urutan, 3);
  assert.ok(Math.abs(history.items[2].delta_persen - (-250 / 450) * 100) < 1e-10);
});

test("actual detail component sorts unsorted initial data and formats dates in WIB", () => {
  const componentLoad = createLoader({
    "next-auth/react": { useSession: () => ({ status: "authenticated" }) },
    "@/components/Auth/SignIn": () => null,
    "@/components/Auth/SignUp": () => null,
    "@iconify/react": { Icon: () => null },
    "next/image": ({ src, alt }) => React.createElement("img", { src, alt }),
    "next/link": ({ href, children, ...props }) => React.createElement("a", { ...props, href }, children),
  });
  const Component = componentLoad(
    "src/app/Lelang/[slugId]/[agentId]/components/RiwayatLelang.tsx",
  ).default;
  const items = screenshotItems().map((item) => ({
    ...item,
    judul: "Fixture riwayat lelang",
    slug: "fixture-riwayat",
    status_tayang: "TERSEDIA",
    nomor_legalitas: "2466",
    nomor_legalitas_list: ["2466"],
    duplikat_ids: [],
    alasan_cocok: [],
    confidence: "PASTI",
    gambar_utama: null,
  }));
  // 27 October in UTC must still display 28 October in Jakarta.
  items[1].tanggal_lelang = "2026-10-27T18:00:00Z";
  const html = renderToStaticMarkup(React.createElement(Component, {
    idProperty: "185768",
    isLoggedIn: true,
    initialData: { ok: true, items, total: 3, total_lain: 2, total_sebidang: 3, total_lot_terkait: 0 },
  }));
  assert.ok(html.indexOf("#173010") < html.indexOf("#174901"));
  assert.ok(html.indexOf("#174901") < html.indexOf("#185768"));
  assert.ok(html.includes("28 Oktober 2026"));
  assert.ok(!html.includes("27 Oktober 2026"));
  assert.ok(html.includes("−55,6%"));
});
