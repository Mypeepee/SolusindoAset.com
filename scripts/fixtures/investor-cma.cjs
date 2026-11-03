/** Explicit synthetic database state; never imported by the application. */
const event = (id, cert, price, area, overrides = {}) => ({
  id_property: id,
  judul: `Fixture rumah ${cert}`,
  slug: `fixture-cma-${id}`,
  id_agent: "fixture-owner",
  jenis_transaksi: "LELANG",
  kategori: "RUMAH",
  status_tayang: "TERSEDIA",
  bukan_properti: false,
  harga: price,
  nilai_limit_lelang: price,
  luas_tanah: area,
  luas_bangunan: 80,
  provinsi: "Jawa Timur",
  kota: "Kota Surabaya",
  kecamatan: "Karangpilang",
  kelurahan: "Kebraon",
  legalitas: "SHM",
  nomor_legalitas: cert,
  alamat_lengkap: `Lokasi fixture Kebraon ${cert}`,
  tanggal_lelang: "2026-11-19T03:00:00Z",
  tanggal_dibuat: "2025-01-01T00:00:00Z",
  ...overrides,
});
const kebraonEvents = [
  event(-101, "00101", 1e9, 100, { tanggal_lelang: "2025-01-01T03:00:00Z" }),
  event(-102, "101", 500e6, 100), // latest record, same physical asset, baseline stays 1B/100
  event(-103, "102", 2e9, 72),
  event(-104, "103", 900e6, 180),
  event(-105, "TARGET", 1e9, 100, {
    nomor_legalitas: "9001",
    tanggal_lelang: "2025-02-01T03:00:00Z",
  }),
  event(-106, "9001", 250e6, 100), // target is excluded from its own CMA
  event(-107, "104", 999e9, 100, { kategori: "TANAH" }), // exact-type exclusion
  event(-108, "105", 999e9, 100, { status_tayang: "TERJUAL" }),
  event(-109, "106", 999e9, 100, { status_tayang: "TARIK_LISTING" }),
  event(-110, "107", 999e9, 100, { nomor_legalitas: null }), // unresolved identity excluded
  event(-111, "108", 999e9, 0), // invalid denominator excluded
];
module.exports = {
  event,
  kebraonEvents,
  expectedAverage: (1e9 / 100 + 2e9 / 72 + 900e6 / 180) / 3,
};
