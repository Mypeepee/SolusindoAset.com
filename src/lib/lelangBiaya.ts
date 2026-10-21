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

// ═══════════════════════════════ TIPE ═══════════════════════════════════════

export type WilayahEksekusi = "JATIM" | "LUAR_JATIM";

export interface InputBiayaLelang {
  /** Nilai limit lelang. */
  limit: number;
  /** Provinsi listing — penentu tarif eksekusi Jawa Timur vs luar. */
  provinsi?: string | null;
  /** Luas tanah (m²) — dasar hitung jumlah paket armada. */
  luasTanah?: number | null;
  /** Luas bangunan (m²) — dasar perkiraan kebutuhan tempat perpindahan. */
  luasBangunan?: number | null;
}

export interface KomponenBiaya {
  kode: string;
  label: string;
  /** Label pendek untuk pesan WhatsApp — baris chat hanya muat ± 35 karakter. */
  labelPesan?: string;
  /** Keterangan rumus ringkas yang tampil di bawah label. */
  rumus: string;
  nominal: number;
  /** Angka belum pasti — tidak ikut dijumlahkan ke subtotal. */
  tentatif?: boolean;
  /** Persentase (0–1) bila komponen berbasis persen. */
  persen?: number;
}

export interface BlokBiaya {
  label: string;
  komponen: KomponenBiaya[];
  subtotal: number;
}

export interface RincianBiayaLelang {
  limit: number;
  wilayah: WilayahEksekusi;
  luasTanah: number;
  luasBangunan: number;
  balikNama: BlokBiaya;
  eksekusi: BlokBiaya;
  feeAgent: BlokBiaya;
  /** Seluruh biaya A + eksekusi worst case + C (tanpa harga aset). */
  totalBiaya: number;
  /** Limit + seluruh biaya dengan skenario eksekusi worst case. */
  totalModal: number;
  /** Band pengosongan yang terpilih — dipakai untuk label & tabel. */
  band: BandPengosongan;
  /** Berapa paket armada yang dibutuhkan. */
  paketArmada: number;
  /** Perkiraan luas tempat penampungan barang (m²), null bila LB tak diketahui. */
  luasTempatPerpindahan: number | null;
}

// The same runtime policy is used by the standalone WhatsApp backend.
import * as policy from '../../backend/whatsapp/services/auction_cost_policy.js';

export interface BandPengosongan {
  /** Batas bawah (inklusif). */
  min: number;
  /** Batas atas (eksklusif). Infinity untuk band terakhir. */
  max: number;
  label: string;
  /** Tarif untuk aset di Jawa Timur. */
  jatim: number;
  /** Tarif untuk aset di luar Jawa Timur. */
  luarJatim: number;
  /**
   * Band teratas tidak memakai nilai tetap: biayanya 5% dari harga limit per
   * sertifikat ditambah Rp 150 jt, berlaku sama di semua wilayah.
   */
  persen?: number;
  tambahanTetap?: number;
}


export const TARIF_BALIK_NAMA = policy.TARIF_BALIK_NAMA;
export const PERSEN_BALIK_NAMA = policy.PERSEN_BALIK_NAMA;
export const FEE_JASA = policy.FEE_JASA;
export const PERSEN_FEE_AGENT = policy.PERSEN_FEE_AGENT;
export const BATAS_FEE_ADVOKAT = policy.BATAS_FEE_ADVOKAT;
export const FEE_ADVOKAT_SAMPAI_5_M = policy.FEE_ADVOKAT_SAMPAI_5_M;
export const FEE_ADVOKAT_DI_ATAS_5_M = policy.FEE_ADVOKAT_DI_ATAS_5_M;
export const TARIF_ARMADA = policy.TARIF_ARMADA;
export const LUAS_TANAH_PER_PAKET = policy.LUAS_TANAH_PER_PAKET;
export const KONSUMSI_JUMLAH_ORANG = policy.KONSUMSI_JUMLAH_ORANG;
export const KONSUMSI_PER_ORANG = policy.KONSUMSI_PER_ORANG;
export const BIAYA_KONSUMSI = policy.BIAYA_KONSUMSI;
export const RASIO_TEMPAT_PERPINDAHAN = policy.RASIO_TEMPAT_PERPINDAHAN;
export const TABEL_PENGOSONGAN: BandPengosongan[] = policy.TABEL_PENGOSONGAN;

export const formatRupiah: (value: number) => string = policy.formatRupiah;
export const formatRupiahRingkas: (value: number) => string = policy.formatRupiahRingkas;
export const formatPersen: (persen: number) => string = policy.formatPersen;
export const wilayahDariProvinsi: (provinsi?: string | null) => WilayahEksekusi = policy.wilayahDariProvinsi;
export const cariBandPengosongan: (limit: number) => BandPengosongan = policy.cariBandPengosongan;
export const tarifBand: (band: BandPengosongan, wilayah: WilayahEksekusi, limit: number) => number = policy.tarifBand;
export const hitungPaketArmada: (luasTanah?: number | null) => number = policy.hitungPaketArmada;
export const hitungBalikNama: (harga: number) => number = policy.hitungBalikNama;
export const hitungFeeAdvokat: (harga: number) => number = policy.hitungFeeAdvokat;
export const hitungBiayaLelang: (input: InputBiayaLelang) => RincianBiayaLelang = policy.hitungBiayaLelang;

// ═══════════════════ TEKS SALINAN UNTUK KLIEN (WHATSAPP) ════════════════════

export interface KonteksPesanBiaya {
  judul?: string | null;
  kategori?: string | null;
  alamat?: string | null;
  kota?: string | null;
  provinsi?: string | null;
  tanggalLelang?: string | null;
  url?: string | null;
  namaAgent?: string | null;
  whatsappAgent?: string | null;
}

const GARIS = "━━━━━━━━━━━━━━";

/**
 * Menyusun teks siap tempel ke WhatsApp. Format sengaja dibuat rapat: WhatsApp
 * mobile hanya muat ± 35 karakter per baris, jadi label dipendekkan dan tidak
 * ada indentasi spasi (WhatsApp memangkas spasi berulang).
 */
export function formatPesanBiayaLelang(
  rincian: RincianBiayaLelang,
  konteks: KonteksPesanBiaya = {}
): string {
  const { balikNama, eksekusi, feeAgent, limit } = rincian;
  const L: string[] = [];

  L.push("*ESTIMASI BIAYA PEMBELIAN LELANG*");
  const namaAset = [konteks.judul, konteks.kategori].find(Boolean);
  if (namaAset) L.push(`_${namaAset}_`);
  const lokasi = [konteks.kota, konteks.provinsi].filter(Boolean).join(", ");
  if (konteks.alamat) L.push(`📍 ${konteks.alamat}`);
  else if (lokasi) L.push(`📍 ${lokasi}`);
  if (konteks.tanggalLelang) L.push(`🗓️ Lelang: ${konteks.tanggalLelang}`);

  L.push("");
  L.push(GARIS);
  L.push("*HARGA LIMIT*");
  L.push(`*${formatRupiah(limit)}*`);
  L.push("_Komponen persentase di bawah dihitung dari harga menang lelang; saat ini diestimasi dari harga limit._");

  L.push("");
  L.push(GARIS);
  L.push("*A. BIAYA BALIK NAMA*");
  L.push("_Komponen persentase mengikuti harga menang lelang._");
  balikNama.komponen.forEach((k) => {
    const label = k.persen ? `${k.label} ${formatPersen(k.persen)}` : k.label;
    L.push(`• ${label} — ${formatRupiah(k.nominal)}`);
  });
  L.push(`▸ *Subtotal: ${formatRupiah(balikNama.subtotal)}*`);

  L.push("");
  L.push(GARIS);
  L.push("*B. PENYELESAIAN PENGOSONGAN*");
  L.push("_Biaya pengosongan selalu menggunakan estimasi eksekusi pengadilan worst case._");
  eksekusi.komponen.forEach((k) => {
    L.push(
      `• ${k.labelPesan ?? k.label} — ${k.tentatif ? "_tentatif_" : formatRupiah(k.nominal)}`
    );
  });
  L.push(`▸ *Estimasi worst case: ${formatRupiah(eksekusi.subtotal)}*`);

  L.push("");
  L.push(GARIS);
  L.push("*C. FEE AGENT*");
  L.push("_Dihitung dari harga menang lelang._");
  feeAgent.komponen.forEach((k) => {
    const label = k.persen ? `${k.label} ${formatPersen(k.persen)}` : k.label;
    L.push(`• ${label} — ${formatRupiah(k.nominal)}`);
  });
  L.push(`▸ *Subtotal: ${formatRupiah(feeAgent.subtotal)}*`);

  L.push("");
  L.push(GARIS);
  L.push("*ESTIMASI MODAL — WORST CASE*");
  L.push(`*${formatRupiah(rincian.totalModal)}*`);
  L.push(`_Limit ${formatRupiahRingkas(limit)}_`);
  L.push(
    `_Balik nama ${formatRupiahRingkas(balikNama.subtotal)} + eksekusi ${formatRupiahRingkas(eksekusi.subtotal)} + fee agent ${formatRupiahRingkas(feeAgent.subtotal)}_`
  );

  L.push("");
  L.push(
    `_Tempat perpindahan barang${
      rincian.luasTempatPerpindahan ? ` (± ${rincian.luasTempatPerpindahan} m²)` : ""
    } bersifat tentatif dan belum masuk total._`
  );
  L.push("_Angka di atas estimasi, belum termasuk pajak & biaya lain di luar daftar._");

  if (konteks.url) {
    L.push("");
    L.push("🔗 Detail aset:");
    L.push(konteks.url);
  }
  if (konteks.namaAgent) {
    L.push("");
    const wa = (konteks.whatsappAgent || "").replace(/^0/, "62").replace(/\D/g, "");
    L.push(`👤 ${konteks.namaAgent}${wa ? ` — wa.me/${wa}` : ""}`);
  }

  return L.join("\n");
}
