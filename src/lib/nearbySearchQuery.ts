import { bacaKueriDekat, kelasDariKata, normalKota, normalNama, pisahWilayah, type KelasTempat } from "./tempat/normalisasi";

export const MIN_NEARBY_RADIUS = 1;
export const MAX_NEARBY_RADIUS = 20_000;

export const normalizeNearbyArea = (area: string) => area.split(",").map((part) => normalKota(part)).filter(Boolean).join(", ");

export interface NearbySearchQuery {
  /** Teks setelah frasa jarak dilepas; nominal budget tetap utuh. */
  withoutDistance: string;
  /** Nama/jenis tempat, tanpa pembuka pencarian dan tanpa wilayah. */
  name: string;
  placeQuery: string;
  kelas: KelasTempat | null;
  wilayah: string | null;
  radius?: number;
  /** Kata kunci properti sebelum frasa dekat. */
  keyword: string;
}

/** Membaca satuan jarak sebelum parser rupiah agar "maksimal 1000 meter"
 * tidak keliru menjadi budget Rp1.000. Angka tanpa satuan tetap dibiarkan. */
export function parseNearbySearchQuery(input: string): NearbySearchQuery | null {
  const near = /\b(?:dekat(?:\s+dengan)?|deket(?:\s+sama)?|dket|dkt|di\s+sekitar(?:an)?|sekitar(?:an)?|near(?:by)?)\s+/i.exec(input);
  const direct = bacaKueriDekat(input);
  if (!near && !kelasDariKata(normalNama(pisahWilayah(direct.inti).nama))) return null;
  let radius: number | undefined;
  const withoutDistance = input.replace(
    /\b(?:(?:dalam\s+)?radius\s*(?:maksimal\s*)?|jarak\s*(?:maksimal\s*)?|maksimal\s*|maks\s*|max\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(kilometer|kilometre|meter|metre|km|m)\b/gi,
    (match, amount: string, unit: string, offset: number) => {
      if (/\b(?:budget|bujet|anggaran|harga)\s*$/i.test(input.slice(0, offset))) return match;
      const number = /^\d{1,3}(?:\.\d{3})+$/.test(amount) ? amount.replace(/\./g, "") : amount.replace(",", ".");
      const meters = Math.round(Number(number) * (/^(km|kilom)/i.test(unit) ? 1000 : 1));
      if (meters < MIN_NEARBY_RADIUS || meters > MAX_NEARBY_RADIUS) return match;
      radius = Math.min(radius ?? meters, meters);
      return " ";
    },
  ).replace(/\s+/g, " ").trim();
  const marker = /\b(?:dekat(?:\s+dengan)?|deket(?:\s+sama)?|dket|dkt|di\s+sekitar(?:an)?|sekitar(?:an)?|near(?:by)?)\s+/i.exec(withoutDistance);
  const prefix = marker ? withoutDistance.slice(0, marker.index).trim() : "";
  const body = marker ? withoutDistance.slice(marker.index + marker[0].length) : withoutDistance;
  const parts = pisahWilayah(body.replace(/^(?:dari|dengan)\s+/i, "").toLowerCase().trim());
  const nama = parts.nama.replace(/[.,;\s]+$/g, "");
  const wilayah = parts.wilayah?.replace(/[.,;\s]+$/g, "") ?? null;
  if (!nama) return null;
  return {
    withoutDistance,
    name: nama,
    placeQuery: wilayah ? `${nama} di ${wilayah.replace(/^(?:daerah|wilayah|area)\s+/i, "")}` : nama,
    kelas: kelasDariKata(normalNama(nama)),
    wilayah: wilayah?.replace(/^(?:daerah|wilayah|area)\s+/i, "") ?? null,
    radius,
    keyword: prefix.replace(/^(?:tolong\s+)?(?:cari(?:kan)?|saya\s+(?:mau|ingin)\s+cari)\s+/i, "")
      .replace(/\b(?:aset|properti|yang|lokasi(?:nya)?)\b/gi, " ").replace(/\s+/g, " ").trim(),
  };
}
