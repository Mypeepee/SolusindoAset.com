const assert = require("node:assert/strict");
const load = require("./lib/investor-test-loader.cjs")({ "@/lib/prisma": {} });
const { assembleAuctionHistory, auctionEffectivePrice } = load(
  "src/lib/auctionHistory.ts",
);
const { summarizeAuctionPrices } = load(
  "src/lib/auction-history-prices.server.ts",
);
const event = (id, price, date, extra = {}) => ({
  id_property: BigInt(id),
  judul: "Fixture history",
  slug: "fixture",
  jenis_transaksi: "LELANG",
  status_tayang: "TERSEDIA",
  kota: "Kota Surabaya",
  provinsi: "Jawa Timur",
  kecamatan: "Wonokromo",
  kelurahan: "Ngagelrejo",
  nomor_legalitas: "00188",
  legalitas: "LAINNYA",
  luas_tanah: 156,
  luas_bangunan: 80,
  alamat_lengkap: "Alamat fixture",
  nilai_limit_lelang: price,
  harga: price,
  tanggal_lelang: date ? new Date(date) : null,
  tanggal_dibuat: new Date("2024-01-01"),
  ...extra,
});
const dates = ["2025-01-01", "2025-02-01", "2025-03-01"];
const current = event(3, 250e6, dates[2]);
function check(target, candidates, expected) {
  const actual = summarizeAuctionPrices(target, candidates);
  assert.equal(actual.dropPct, expected);
  const history = assembleAuctionHistory(target, candidates).filter(
    (e) => e.verdict.cakupan === "SAMA",
  );
  const currentIndex = history.findIndex(
    (e) => String(e.row.id_property) === String(target.id_property),
  );
  const valid = history
    .slice(0, currentIndex + 1)
    .filter((e) => auctionEffectivePrice(e.row) !== null);
  if (expected !== null)
    assert.equal(actual.initialPrice, auctionEffectivePrice(valid[0].row));
  return actual;
}
check(current, [event(1, 1e9, dates[0])], 75);
// Initial is chronological, not the historical maximum (2B -> 250M = 87.5% is wrong).
check(current, [event(1, 1e9, dates[0]), event(2, 2e9, dates[1])], 75);
check(
  event(64493, 306e6, "2025-12-29"),
  [event(54948, 306e6, "2025-12-09")],
  0,
);
check(event(3, 1.5e9, dates[2]), [event(1, 1e9, dates[0])], -50);
check(current, [], null);
check(current, [event(4, 1e9, "2027-01-01")], null); // no look-ahead
check(current, [event(1, 1e9, dates[0], { luas_tanah: 350 })], null); // different parcel
check(current, [event(1, 1e9, dates[0], { kota: "Kota Malang" })], null);
check(
  current,
  [event(1, 1e9, dates[0], { nomor_legalitas: "188,189", luas_tanah: 300 })],
  null,
); // broader lot
check(current, [event(1, 0, dates[0])], null);
check(current, [event(1, 0, dates[0], { harga: 1e9 })], 75); // existing effective-price fallback
check(current, [event(1, 1e9, dates[0], { kelurahan: null })], 75); // mature matcher accepts supporting evidence
const changed = check(
  current,
  [event(1, 1e9, dates[0], { kelurahan: "Ngagelrejo", luas_bangunan: 999999 })],
  75,
);
assert.equal(changed.points.length, 2);
const duplicates = check(
  current,
  [event(1, 1e9, dates[0]), event(2, 1e9, dates[0])],
  75,
);
assert.equal(duplicates.eventCount, 2);
check(event(3, 250e6, dates[0]), [event(2, 250e6, dates[0])], null); // duplicate, no second auction
console.log(
  "Auction history passed: 1B -> 250M = 75%; 306M -> 306M = 0%; chronological baseline, no max-price/future/other-parcel discount; duplicate and missing evidence safeguards; same collector as Riwayat Lelang Aset.",
);
