// Shared business estimates for website, MOU PDFs and WhatsApp. Pure arithmetic; no I/O.
/**
* ────────────────────────────────────────────────────────────────────────────
* MESIN ESTIMASI BIAYA PEMBELIAN ASET LELANG
* ────────────────────────────────────────────────────────────────────────────
* Satu-satunya sumber kebenaran untuk angka biaya lelang di seluruh website
* (sidebar agent, dock mobile, sheet rincian, teks salinan untuk klien).
*
* Prinsipnya: SEMUA MASUKAN DIAMBIL DARI DATA LISTING — harga selalu memakai
* nilai limit, wilayah dibaca dari provinsi, kebutuhan armada dari luas tanah.
* Tidak ada satu pun angka yang harus diisi manual oleh agent, supaya hasil
* yang dibacakan ke klien selalu sama dari siapa pun agent-nya.
*
* Tiga kelompok biaya yang selalu ditanya klien:
*   A. BALIK NAMA  → persentase dari harga menang + fee jasa tetap.
*   B. EKSEKUSI    → biaya pengosongan aset yang masih berpenghuni.
*   C. FEE AGENT   → 5% dari harga menang lelang.
*
* Sebelum lelang selesai, harga menang belum tersedia. Semua persentase
* diestimasi dari harga limit dan harus menyesuaikan harga menang final.
*/
// ═══════════════════════════ TARIF & KONSTANTA ══════════════════════════════
/** Komponen persentase biaya balik nama. Totalnya 8,5% dari harga menang (estimasi: limit). */
export const TARIF_BALIK_NAMA = [
  { kode: "bea_lelang", label: "Bea Lelang", persen: 0.02 },
  { kode: "bphtb", label: "BPHTB", persen: 0.05 },
  { kode: "ppn_lelang", label: "PPN Lelang", persen: 0.011 },
  { kode: "roya_balik_nama", label: "Roya & Balik Nama", persen: 0.004 },
];
/** Jumlah seluruh komponen persentase balik nama (8,5%). */
export const PERSEN_BALIK_NAMA = TARIF_BALIK_NAMA.reduce((a, t) => a + t.persen, 0);
/** Fee jasa pengurusan dokumen — nilai tetap, tidak ikut harga. */
export const FEE_JASA = 10_000_000;
/** Fee agent dihitung dari harga menang lelang (diestimasi dari limit). */
export const PERSEN_FEE_AGENT = 0.05;
/** Fee advokat eksekusi: sampai Rp 5 M = Rp 25 jt, selebihnya = Rp 50 jt. */
export const BATAS_FEE_ADVOKAT = 5_000_000_000;
export const FEE_ADVOKAT_SAMPAI_5_M = 25_000_000;
export const FEE_ADVOKAT_DI_ATAS_5_M = 50_000_000;
/** Satu paket armada: 6 truk + 15 kuli, kerja ± 2 jam. */
export const TARIF_ARMADA = 6_800_000;
/** Satu paket armada menangani sampai 240 m² luas tanah. */
export const LUAS_TANAH_PER_PAKET = 240;
/** Konsumsi aparat pelaksana eksekusi: 100 orang × Rp 30.000. */
export const KONSUMSI_JUMLAH_ORANG = 100;
export const KONSUMSI_PER_ORANG = 30_000;
export const BIAYA_KONSUMSI = KONSUMSI_JUMLAH_ORANG * KONSUMSI_PER_ORANG;
/** Tempat perpindahan diperkirakan seluas 50% luas bangunan. */
export const RASIO_TEMPAT_PERPINDAHAN = 0.5;
/** Tabel biaya eksekusi pengosongan menurut harga limit. */
export const TABEL_PENGOSONGAN = [
  { min: 0, max: 500_000_000, label: "< Rp 500 jt", jatim: 125_000_000, luarJatim: 150_000_000 },
  {
    min: 500_000_000,
    max: 1_500_000_000,
    label: "Rp 500 jt – Rp 1,5 M",
    jatim: 150_000_000,
    luarJatim: 175_000_000,
  },
  {
    min: 1_500_000_000,
    max: 2_500_000_000,
    label: "Rp 1,5 M – Rp 2,5 M",
    jatim: 200_000_000,
    luarJatim: 225_000_000,
  },
  {
    min: 2_500_000_000,
    max: 5_000_000_000,
    label: "Rp 2,5 M – Rp 5 M",
    jatim: 325_000_000,
    luarJatim: 350_000_000,
  },
  {
    min: 5_000_000_000,
    max: 10_000_000_000,
    label: "Rp 5 M – Rp 10 M",
    jatim: 625_000_000,
    luarJatim: 675_000_000,
  },
  {
    min: 10_000_000_000,
    max: Infinity,
    label: "> Rp 10 M",
    jatim: 0,
    luarJatim: 0,
    persen: 0.05,
    tambahanTetap: 150_000_000,
  },
];
// ═══════════════════════════ PEMFORMATAN ANGKA ══════════════════════════════
export const formatRupiah = (value) => {
  if (!value || !isFinite(value))
    return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
};
/** Versi ringkas untuk ruang sempit: Rp 3,5 M · Rp 605 Jt */
export const formatRupiahRingkas = (value) => {
  if (!value || !isFinite(value))
    return "Rp 0";
  const trim = (n) => n.toFixed(n % 1 === 0 ? 0 : 1).replace(".", ",");
  if (value >= 1_000_000_000_000)
    return `Rp ${trim(value / 1_000_000_000_000)} T`;
  if (value >= 1_000_000_000)
    return `Rp ${trim(value / 1_000_000_000)} M`;
  if (value >= 1_000_000)
    return `Rp ${Math.round(value / 1_000_000)} Jt`;
  return formatRupiah(value);
};
/** "2%", "1,1%", "0,4%" — tanpa nol di belakang koma. */
export const formatPersen = (persen) => `${(persen * 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",")}%`;
// ═════════════════════════════ KALKULASI ════════════════════════════════════
/** Deteksi wilayah dari kolom provinsi listing. */
export const wilayahDariProvinsi = (provinsi) => /jawa\s*tim|jatim|east\s*java/i.test(String(provinsi || "")) ? "JATIM" : "LUAR_JATIM";
export const cariBandPengosongan = (limit) => {
  const nilai = Math.max(0, limit || 0);
  return (TABEL_PENGOSONGAN.find((b) => nilai >= b.min && nilai < b.max) ??
    TABEL_PENGOSONGAN[TABEL_PENGOSONGAN.length - 1]);
};
/** Tarif satu band untuk satu wilayah. Band teratas dihitung dari harga limit. */
export const tarifBand = (band, wilayah, limit) => {
  if (band.persen != null) {
    return Math.round(limit * band.persen) + (band.tambahanTetap ?? 0);
  }
  return wilayah === "JATIM" ? band.jatim : band.luarJatim;
};
/** Jumlah paket armada: satu paket per 240 m² luas tanah, minimal satu. */
export const hitungPaketArmada = (luasTanah) => {
  const luas = Number(luasTanah) || 0;
  if (luas <= 0)
    return 1;
  return Math.max(1, Math.floor(luas / LUAS_TANAH_PER_PAKET));
};
/** Biaya balik nama: 8,5% dari harga menang (estimasi: limit) + fee jasa tetap. */
export const hitungBalikNama = (harga) => {
  if (!harga || harga <= 0)
    return 0;
  return Math.round(harga * PERSEN_BALIK_NAMA) + FEE_JASA;
};
/** Fee advokat untuk pendampingan eksekusi pengosongan. */
export const hitungFeeAdvokat = (harga) => harga > BATAS_FEE_ADVOKAT ? FEE_ADVOKAT_DI_ATAS_5_M : FEE_ADVOKAT_SAMPAI_5_M;
export function hitungBiayaLelang(input) {
  const sourceLimit = Math.max(0, Number(input.limit) || 0);
  const limit = Math.round(sourceLimit);
  /** @type {'JATIM'|'LUAR_JATIM'} */
  const wilayah = wilayahDariProvinsi(input.provinsi);
  const luasTanah = Number(input.luasTanah) || 0;
  const luasBangunan = Number(input.luasBangunan) || 0;
  // ── A. BALIK NAMA ─────────────────────────────────────────────────────────
  const komponenBalikNama = TARIF_BALIK_NAMA.map((t) => ({
    kode: t.kode,
    label: t.label,
    rumus: `${formatPersen(t.persen)} × harga menang lelang (estimasi: limit)`,
    nominal: Math.round(sourceLimit * t.persen),
    persen: t.persen,
  }));
  komponenBalikNama.push({
    kode: "fee_jasa",
    label: "Fee Jasa Pengurusan",
    rumus: "Nilai tetap",
    nominal: FEE_JASA,
  });
  const subtotalBalikNama = komponenBalikNama.reduce((a, k) => a + k.nominal, 0);
  // ── B. EKSEKUSI PENGADILAN — SELALU WORST CASE ───────────────────────────
  const band = cariBandPengosongan(limit);
  const biayaPengosongan = tarifBand(band, wilayah, limit);
  const feeAdvokat = hitungFeeAdvokat(limit);
  const paketArmada = hitungPaketArmada(luasTanah);
  const luasTempatPerpindahan = luasBangunan > 0 ? Math.round(luasBangunan * RASIO_TEMPAT_PERPINDAHAN) : null;
  const namaWilayah = wilayah === "JATIM" ? "Jawa Timur" : "luar Jawa Timur";
  // Seluruh estimasi modal memakai biaya eksekusi worst case.
  const komponenEksekusi = [
    {
      kode: "pengosongan",
      label: "Eksekusi Pengosongan",
      labelPesan: "Eksekusi pengosongan",
      rumus: band.persen
        ? `${formatPersen(band.persen)} × limit + ${formatRupiahRingkas(band.tambahanTetap ?? 0)}`
        : `Limit ${band.label} · ${namaWilayah}`,
      nominal: biayaPengosongan,
    },
    {
      kode: "armada",
      label: "Transportasi & Tenaga Angkut",
      labelPesan: `Transportasi 6 truk + 15 kuli${paketArmada > 1 ? ` ×${paketArmada}` : ""}`,
      rumus: `6 truk + 15 kuli${paketArmada > 1 ? ` × ${paketArmada} paket` : ""}` +
        (luasTanah > 0 ? ` · LT ${luasTanah} m²` : ""),
      nominal: TARIF_ARMADA * paketArmada,
    },
    {
      kode: "konsumsi",
      label: "Konsumsi Aparat",
      labelPesan: `Konsumsi aparat (${KONSUMSI_JUMLAH_ORANG} orang)`,
      rumus: `${KONSUMSI_JUMLAH_ORANG} orang × ${formatRupiah(KONSUMSI_PER_ORANG)}`,
      nominal: BIAYA_KONSUMSI,
    },
    {
      kode: "fee_advokat",
      label: "Fee Jasa Advokat",
      labelPesan: "Fee jasa advokat",
      rumus: limit > BATAS_FEE_ADVOKAT
        ? "Harga menang di atas Rp 5 M"
        : "Harga menang sampai Rp 5 M",
      nominal: feeAdvokat,
    },
    {
      kode: "tempat_perpindahan",
      label: "Tempat Perpindahan Barang",
      labelPesan: "Tempat perpindahan barang",
      rumus: luasTempatPerpindahan
        ? `Perlu ± ${luasTempatPerpindahan} m² (50% luas bangunan)`
        : "± 50% luas bangunan",
      nominal: 0,
      tentatif: true,
    },
  ];
  const subtotalEksekusi = komponenEksekusi.reduce((a, k) => a + (k.tentatif ? 0 : k.nominal), 0);
  // ── C. FEE AGENT ─────────────────────────────────────────────────────────
  const komponenFeeAgent = [
    {
      kode: "fee_agent",
      label: "Fee Agent",
      labelPesan: "Fee agent 5%",
      rumus: `${formatPersen(PERSEN_FEE_AGENT)} × harga menang lelang (estimasi: limit)`,
      nominal: Math.round(sourceLimit * PERSEN_FEE_AGENT),
      persen: PERSEN_FEE_AGENT,
    },
  ];
  const subtotalFeeAgent = komponenFeeAgent.reduce((a, k) => a + k.nominal, 0);
  const totalBiaya = subtotalBalikNama + subtotalEksekusi + subtotalFeeAgent;
  return {
    limit,
    wilayah,
    luasTanah,
    luasBangunan,
    balikNama: { label: "Biaya Balik Nama", komponen: komponenBalikNama, subtotal: subtotalBalikNama },
    eksekusi: { label: "Biaya Eksekusi Pengosongan", komponen: komponenEksekusi, subtotal: subtotalEksekusi },
    feeAgent: { label: "Fee Agent", komponen: komponenFeeAgent, subtotal: subtotalFeeAgent },
    totalBiaya,
    totalModal: limit + totalBiaya,
    band,
    paketArmada,
    luasTempatPerpindahan,
  };
}
