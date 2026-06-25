/**
 * regionSearch — utilitas bersama untuk pencarian lokasi multi-wilayah.
 *
 * Dipakai oleh seluruh search bar (Home, Jual, Lelang, halaman kategori) dan
 * builder filter Prisma di server. Menjembatani dua sumber data yang formatnya
 * berbeda:
 *
 *   - Dropdown wilayah  : dataset ibnux/data-indonesia → kota DENGAN prefix,
 *                         mis. "Kota Surabaya", "Kabupaten Gresik".
 *   - Data listing (DB) : hasil Google Geocoding yang prefix-nya sudah dibuang
 *                         (lihat tambah-property/.../Step2Location.tsx) →
 *                         mis. "Surabaya", "Gresik".
 *
 * Maka nama kota dinormalisasi (buang prefix administratif) sebelum dipakai
 * untuk membangun URL maupun query, supaya pencocokan ke DB konsisten.
 */

export type RegionLevel = "provinsi" | "kota" | "kecamatan" | "kelurahan";

export interface SelectedRegion {
  /** id wilayah (ibnux) saat dipilih langsung, atau id sintetis "level:name" saat dihidrasi dari URL. */
  id: string;
  name: string;
  level: RegionLevel;
  /** opsional: konteks induk untuk tampilan, mis. provinsi dari sebuah kota. */
  parent?: string;
}

export const REGION_LEVELS: RegionLevel[] = [
  "provinsi",
  "kota",
  "kecamatan",
  "kelurahan",
];

/** Prefix administratif yang membedakan format ibnux dari format DB (level kota). */
const KOTA_PREFIX_RE =
  /^(kota administrasi|kabupaten administrasi|kota adm\.?|kab\.? adm\.?|kabupaten|kota|kab\.?)\s+/i;

/**
 * Normalisasi nama wilayah ke "nama inti" yang cocok dengan nilai tersimpan di
 * DB. Untuk kota, prefix "Kota/Kabupaten/…" dibuang; level lain cukup di-trim
 * karena formatnya sudah selaras dengan data geocoder.
 */
export function normalizeRegionName(name: string, level: RegionLevel): string {
  const trimmed = (name || "").trim();
  if (level === "kota") {
    return trimmed.replace(KOTA_PREFIX_RE, "").trim();
  }
  return trimmed;
}

/**
 * Identitas pemilihan di picker — pakai nama LENGKAP (dengan prefix) agar
 * "Kota X" dan "Kabupaten X" tetap DIBEDAKAN (mereka wilayah berbeda dengan id
 * ibnux berbeda). Jangan dinormalisasi di sini: normalizeRegionName khusus
 * untuk serialisasi URL / pencocokan DB (di mana data memang sudah strip
 * prefix sehingga tak bisa dibedakan).
 */
export function regionKey(r: { name: string; level: RegionLevel }): string {
  return `${r.level}|${r.name.trim().toLowerCase()}`;
}

/** Apakah dua wilayah merujuk lokasi yang sama (berdasarkan level + nama inti). */
export function isSameRegion(
  a: { name: string; level: RegionLevel },
  b: { name: string; level: RegionLevel }
): boolean {
  return regionKey(a) === regionKey(b);
}

/**
 * Kelompokkan wilayah terpilih per level → nilai param URL (nama dinormalisasi,
 * dedupe, dipisah koma). Mengembalikan hanya level yang terisi.
 */
export function serializeLocations(
  regions: SelectedRegion[]
): Partial<Record<RegionLevel, string>> {
  const byLevel: Record<RegionLevel, string[]> = {
    provinsi: [],
    kota: [],
    kecamatan: [],
    kelurahan: [],
  };

  for (const r of regions) {
    const name = normalizeRegionName(r.name, r.level);
    if (!name) continue;
    const bucket = byLevel[r.level];
    if (!bucket.some((n) => n.toLowerCase() === name.toLowerCase())) {
      bucket.push(name);
    }
  }

  const out: Partial<Record<RegionLevel, string>> = {};
  for (const level of REGION_LEVELS) {
    if (byLevel[level].length) out[level] = byLevel[level].join(",");
  }
  return out;
}

/**
 * Tuangkan wilayah terpilih ke URLSearchParams. Selalu hapus 4 key lokasi lebih
 * dulu (membersihkan nilai lama) lalu set yang terisi — aman untuk params baru
 * maupun yang dipakai ulang.
 */
export function setLocationParams(
  params: URLSearchParams,
  regions: SelectedRegion[]
): void {
  const serialized = serializeLocations(regions);
  for (const level of REGION_LEVELS) {
    params.delete(level);
    const val = serialized[level];
    if (val) params.set(level, val);
  }
}

export interface ParsedLocations {
  provinsi: string[];
  kota: string[];
  kecamatan: string[];
  kelurahan: string[];
}

function splitCsv(v: string | string[] | undefined | null): string[] {
  if (v == null) return [];
  const raw = Array.isArray(v) ? v.join(",") : v;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Baca param lokasi multi-level dari sumber apa pun. `get` mengembalikan nilai
 * mentah untuk sebuah key:
 *   - server (Next searchParams): (k) => searchParams[k]
 *   - client (URLSearchParams)  : (k) => sp.get(k)
 */
export function parseLocationParams(
  get: (key: string) => string | string[] | undefined | null
): ParsedLocations {
  return {
    provinsi: splitCsv(get("provinsi")),
    kota: splitCsv(get("kota")),
    kecamatan: splitCsv(get("kecamatan")),
    kelurahan: splitCsv(get("kelurahan")),
  };
}

/** Versi praktis untuk objek searchParams server-component. */
export function parseLocationsFromSearchParams(searchParams: {
  [key: string]: string | string[] | undefined;
}): ParsedLocations {
  return parseLocationParams((k) => searchParams[k]);
}

/**
 * Ubah hasil parse menjadi SelectedRegion[] untuk menghidrasi UI picker dari
 * URL. Memakai id sintetis "level:name" (stabil & unik untuk key React/toggle).
 */
export function locationsToSelectedRegions(
  parsed: ParsedLocations
): SelectedRegion[] {
  const out: SelectedRegion[] = [];
  for (const level of REGION_LEVELS) {
    for (const name of parsed[level]) {
      out.push({ id: `${level}:${name}`, name, level });
    }
  }
  return out;
}

/** True bila ada minimal satu wilayah terpilih di URL. */
export function hasAnyLocation(parsed: ParsedLocations): boolean {
  return (
    parsed.provinsi.length > 0 ||
    parsed.kota.length > 0 ||
    parsed.kecamatan.length > 0 ||
    parsed.kelurahan.length > 0
  );
}
