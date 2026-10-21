import { parseNearbySearchQuery } from "./nearbySearchQuery";
import { SURABAYA_REGIONS } from "../../backend/whatsapp/services/search_scope.js";
export { SURABAYA_REGIONS };

/** Pembagian wilayah mengikuti daftar kecamatan yang dipakai situs. */

export type SurabayaRegion = keyof typeof SURABAYA_REGIONS;

export function surabayaRegionLabel(region: SurabayaRegion): string {
  return `Surabaya ${region[0].toUpperCase()}${region.slice(1)}`;
}

const NUMBER = String.raw`(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(?:miliar|milyar|juta|ribu|jt|rb|m)`;
const MONEY = String.raw`(?:rp\.?\s*)?(${NUMBER})\s*(${UNIT})?`;
const MAX = String.raw`(?:maksimal|maksimum|maks|max|mentok|paling\s+mahal|di\s+bawah|dibawah|sampai|hingga)`;
const MIN = String.raw`(?:minimal|minimum|min|mulai(?:\s+dari)?|di\s+atas|diatas)`;
const BUDGET = String.raw`(?:budget|bujet|anggaran|harga)`;

function rupiah(raw: string, unit?: string): number | undefined {
  const number = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)
    ? Number(raw.replace(/\./g, "").replace(",", "."))
    : Number(raw.replace(",", "."));
  const scale = /^(m|miliar|milyar)$/i.test(unit ?? "") ? 1e9
    : /^(jt|juta)$/i.test(unit ?? "") ? 1e6
    : /^(rb|ribu)$/i.test(unit ?? "") ? 1e3 : 1;
  const value = number * scale;
  // Angka kecil tanpa satuan bisa berarti nomor jalan/rumah, bukan rupiah.
  return Number.isSafeInteger(value) && value > 0 && value <= 1e15 && (unit || value >= 1000)
    ? value : undefined;
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Parser deterministik: wilayah menjadi cakupan kecamatan; nominal dengan
 * penanda budget/batas menjadi harga. Angka murni tetap ID properti.
 * `keyword` masih memuat wilayah agar terlihat di search bar dan chip hasil.
 * `text` hanya memuat sisa kata yang benar-benar perlu dicari sebagai teks.
 */
export function parsePropertySearchQuery(input: string) {
  const nearbyInput = parseNearbySearchQuery(input);
  let keyword = nearbyInput?.withoutDistance ?? input.trim();
  let minHarga: number | undefined;
  let maxHarga: number | undefined;
  const lower = (value: number) => { minHarga = Math.max(minHarga ?? value, value); };
  const upper = (value: number) => { maxHarga = Math.min(maxHarga ?? value, value); };

  // Kedua ujung harus berupa nominal; satuan di ujung boleh dipakai bersama.
  keyword = keyword.replace(
    new RegExp(String.raw`\b(?:${BUDGET}\s*)?${MONEY}\s*(?:-|–|s\/d|sampai|hingga)\s*${MONEY}\b`, "gi"),
    (match, first: string, firstUnit: string | undefined, last: string, lastUnit: string | undefined) => {
      if (!firstUnit && !lastUnit && !new RegExp(`^(?:${BUDGET}|rp)`, "i").test(match)) return match;
      const min = rupiah(first, firstUnit ?? lastUnit);
      const max = rupiah(last, lastUnit ?? firstUnit);
      if (min === undefined || max === undefined) return match;
      lower(Math.min(min, max));
      upper(Math.max(min, max));
      return " ";
    },
  );

  keyword = keyword.replace(
    new RegExp(String.raw`\b(?:${BUDGET}\s*(?:(${MIN}|${MAX})\s*)?|(${MIN}|${MAX})\s*)${MONEY}\b(?:\s+(?:${MAX})\b(?!\s*(?:rp\.?\s*)?\d))?`, "gi"),
    (match, budgetBound: string | undefined, bound: string | undefined, amount: string, unit: string | undefined) => {
      const value = rupiah(amount, unit);
      if (value === undefined) return match;
      if (new RegExp(`^${MIN}$`, "i").test(budgetBound ?? bound ?? "")) lower(value);
      else upper(value);
      return " ";
    },
  );

  keyword = keyword.replace(
    new RegExp(String.raw`\b${MONEY}\s+(${MAX})\b`, "gi"),
    (match, amount: string, unit: string | undefined) => {
      const value = rupiah(amount, unit);
      if (value === undefined) return match;
      upper(value);
      return " ";
    },
  );
  keyword = clean(keyword);

  const regions: SurabayaRegion[] = [];
  let text = keyword.replace(
    /\b(?:di\s+)?(?:kota\s+)?(?:surabaya|sby)\s+(barat|selatan|timur|pusat|utara)\b/gi,
    (_match, direction: string) => {
      const region = direction.toLowerCase() as SurabayaRegion;
      if (!regions.includes(region)) regions.push(region);
      return " ";
    },
  );
  if (regions.length) {
    text = text.replace(/[(),]/g, " ");
    // Penghubung antardaerah / budget tidak boleh menjadi syarat alamat.
    text = text.replace(/^\s*(?:(?:dan|atau|dengan)\b\s*)+|(?:\s*\b(?:dan|atau|dengan))+\s*$/gi, " ");
  }

  const nearby = parseNearbySearchQuery(keyword);
  return { keyword, text: clean(text), regions, minHarga, maxHarga,
    nearby: nearby ? { ...nearby, radius: nearbyInput?.radius ?? nearby.radius } : null };
}

/** Pindahkan budget dari kata kunci ke filter harga yang dapat diedit user. */
export function applyPropertySearchQuery(params: URLSearchParams): void {
  if (/^\d{1,18}$/.test(params.get("idProperty") ?? "")) return;
  const q = params.get("q");
  if (!q) return;
  const parsed = parsePropertySearchQuery(q);
  if (parsed.minHarga === undefined && parsed.maxHarga === undefined && !parsed.nearby) return;
  if (parsed.keyword) params.set("q", parsed.keyword);
  else params.delete("q");
  if (parsed.nearby) {
    if (parsed.nearby.radius !== undefined) {
      const current = Number(params.get("radius"));
      params.set("radius", String(Number.isFinite(current) && current > 0
        ? Math.min(current, parsed.nearby.radius) : parsed.nearby.radius));
    }
    if (parsed.nearby.kelas && !params.has("dekat")) {
      const { kelas, wilayah } = parsed.nearby;
      params.set("dekat", `kelas:${kelas}${wilayah ? `@${wilayah.replace(/\s+/g, "-")}` : ""}`);
      if (parsed.nearby.keyword) params.set("q", parsed.nearby.keyword);
      else params.delete("q");
    }
    if (parsed.nearby.wilayah) params.set("areaDekat", parsed.nearby.wilayah);
    if (params.has("dekat")) {
      if (parsed.nearby.keyword) params.set("q", parsed.nearby.keyword);
      else params.delete("q");
    }
  }
  for (const key of ["minHarga", "maxHarga"] as const) {
    const value = parsed[key];
    if (value === undefined) continue;
    const existing = Number((params.get(key) ?? "").replace(/[.\s]/g, ""));
    const combined = Number.isFinite(existing) && existing > 0
      ? (key === "maxHarga" ? Math.min(existing, value) : Math.max(existing, value))
      : value;
    params.set(key, String(combined));
  }
}

/** URL lama/tautan manual memakai normalisasi yang sama dengan tombol Cari. */
export function propertySearchRedirect(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): string | undefined {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  const before = params.toString();
  applyPropertySearchQuery(params);
  return params.toString() === before ? undefined : `${pathname}?${params}`;
}
