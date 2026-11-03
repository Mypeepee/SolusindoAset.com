export const JENIS_DISKON = ["KELURAHAN", "TURUN_LELANG", "KEDUANYA"] as const;
export type JenisDiskon = (typeof JENIS_DISKON)[number];

export const LABEL_DISKON: Record<JenisDiskon, string> = {
  KELURAHAN: "Diskon kelurahan",
  TURUN_LELANG: "Diskon turun lelang",
  KEDUANYA: "Keduanya",
};

export type PreferensiDiskon = {
  diskon_jenis?: string | null;
  diskon_persen?: unknown;
};

export type MetrikDiskon = {
  kelurahan: number | null;
  turunLelang: number | null;
};

export type LokasiDiskon = {
  loc_provinsi?: string | null;
  loc_kota?: string | null;
  loc_kecamatan?: string | null;
  loc_kelurahan?: string | null;
};
export const kunciDiskon = (p: PreferensiDiskon & LokasiDiskon & { maksud: string }) => JSON.stringify([
  p.maksud, p.diskon_jenis, p.diskon_persen,
  p.loc_provinsi || "", p.loc_kota || "", p.loc_kecamatan || "", p.loc_kelurahan || "",
]);

/** Empty means no discount criterion. Both fields must otherwise be present. */
export function masalahDiskon(p: PreferensiDiskon): string | null {
  const jenis = p.diskon_jenis;
  const persen = p.diskon_persen;
  const kosong = persen === "" || persen === null || persen === undefined;
  if (!jenis && kosong) return null;
  if (!JENIS_DISKON.includes(jenis as JenisDiskon)) return "Pilih jenis diskon terlebih dahulu";
  if (kosong) return "Isi persentase diskon 1–99%";
  if ((typeof persen !== "string" && typeof persen !== "number") || !/^[1-9]\d?$/.test(String(persen))) return "Gunakan angka bulat 1–99 tanpa nol di depan";
  return null;
}

/** Reject junk/overflow; normalize pasted leading zeros as well as typed zeros. */
export function inputPersenDiskon(raw: string, sebelumnya: string): string {
  if (!/^\d*$/.test(raw)) return sebelumnya;
  const nilai = raw.replace(/^0+/, "");
  return nilai.length <= 2 ? nilai : sebelumnya;
}

export function lolosDiskon(
  p: PreferensiDiskon,
  metrics: MetrikDiskon,
): boolean {
  if (masalahDiskon(p)) return false;
  if (!p.diskon_jenis) return true;
  const batas = Number(p.diskon_persen);
  const kelurahan = metrics.kelurahan !== null && Number.isFinite(metrics.kelurahan) && metrics.kelurahan > batas;
  const lelang = metrics.turunLelang !== null && Number.isFinite(metrics.turunLelang) && metrics.turunLelang > batas;
  return p.diskon_jenis === "KELURAHAN" ? kelurahan : p.diskon_jenis === "TURUN_LELANG" ? lelang : kelurahan && lelang;
}

export function ringkasDiskon(p: PreferensiDiskon): string | null {
  if (!p.diskon_jenis || masalahDiskon(p)) return null;
  const label = p.diskon_jenis === "KEDUANYA" ? "Diskon kelurahan & turun lelang" : LABEL_DISKON[p.diskon_jenis as JenisDiskon];
  return `${label} > ${p.diskon_persen}%`;
}
