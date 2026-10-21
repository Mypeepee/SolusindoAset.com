import type { WalletKey } from "@/lib/project-kas";

/** Kategori arus kas yang boleh dipilih manual (setoran modal & talangan
 *  dibuat otomatis sistem, jadi sengaja tidak ada di sini). */
export const KATEGORI_PENGELUARAN = [
  { value: "pembelian_aset", label: "Pembelian aset", icon: "solar:home-2-bold-duotone" },
  { value: "biaya_spare_bidding", label: "Biaya lelang", icon: "solar:tag-price-bold-duotone" },
  { value: "biaya_dokumen_balik_nama", label: "Dokumen & balik nama", icon: "solar:document-text-bold-duotone" },
  { value: "biaya_eksekusi_pengosongan", label: "Eksekusi & pengosongan", icon: "solar:shield-warning-bold-duotone" },
  { value: "biaya_renovasi", label: "Renovasi", icon: "solar:pallete-2-bold-duotone" },
  { value: "penggunaan_dana_cadangan", label: "Biaya tak terduga", icon: "solar:danger-triangle-bold-duotone" },
  { value: "pengeluaran_lain", label: "Pengeluaran lain", icon: "solar:wallet-money-bold-duotone" },
] as const;

export const KATEGORI_PEMASUKAN = [
  { value: "hasil_penjualan", label: "Hasil penjualan", icon: "solar:buildings-2-bold-duotone" },
  { value: "refund", label: "Pengembalian dana", icon: "solar:refresh-circle-bold-duotone" },
  { value: "pemasukan_lain", label: "Pemasukan lainnya", icon: "solar:banknote-2-bold-duotone" },
] as const;

export type KategoriOption = { value: string; label: string; icon: string };

export function kategoriOptions(jenis: "pemasukan" | "pengeluaran") {
  return jenis === "pemasukan"
    ? (KATEGORI_PEMASUKAN as readonly KategoriOption[])
    : (KATEGORI_PENGELUARAN as readonly KategoriOption[]);
}

/** Kategori default per pos — sama persis dengan `inferKategori` di server. */
export function defaultKategori(
  walletKey: WalletKey,
  jenis: "pemasukan" | "pengeluaran"
): string {
  if (jenis === "pemasukan") return "pemasukan_lain";

  switch (walletKey) {
    case "dokumen":
      return "biaya_dokumen_balik_nama";
    case "eksekusi":
      return "biaya_eksekusi_pengosongan";
    case "renovasi":
      return "biaya_renovasi";
    case "cadangan":
      return "penggunaan_dana_cadangan";
    case "utama":
    default:
      return "pembelian_aset";
  }
}

export function kategoriLabel(value: string) {
  const found = [...KATEGORI_PENGELUARAN, ...KATEGORI_PEMASUKAN].find(
    (item) => item.value === value
  );

  if (found) return found.label;

  if (value === "setoran_modal") return "Setoran modal";
  if (value === "talangan_investor") return "Talangan investor";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
