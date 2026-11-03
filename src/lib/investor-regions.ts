import { KOTA_KE_PROVINSI } from "@/lib/lelang/wilayah.mjs";
import { normText, normWilayah, parseKota } from "@/lib/auctionHistory";
import type { InvestorCity } from "@/lib/investor-deals";

type RegionRow = {
  provinsi: string | null;
  kota: string;
  kecamatan?: string | null;
  kelurahan?: string | null;
};
const provinceByCity: Readonly<Record<string, string>> = KOTA_KE_PROVINSI;
// Reuse the scraper's maintained municipality/province mapping. Raw province
// strings contain aliases, English names and OCR fragments; they are not IDs.
const canonicalProvince = (row: RegionRow) =>
  provinceByCity[normText(parseKota(row.kota).core) ?? ""] || row.provinsi;
interface CityRecord extends InvestorCity {
  regions: RegionRow[];
}
const key = (value: string | null | undefined) =>
  (normWilayah(value) ?? "").replace(/\s/g, "");
const provinceKey = (value: string | null | undefined) =>
  (normText(value) ?? "").replace(/\s/g, "");
const display = (value: string) =>
  value
    .toLocaleLowerCase("id-ID")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("id-ID"));
const rawRegionKey = (row: RegionRow) =>
  JSON.stringify([row.provinsi, row.kota]);

/** IDs are stable, parent-qualified database keys, not invented government IDs.
 * Untyped city names are merged only when there is one unambiguous municipality. */
export function buildCityRegistry(regions: RegionRow[]) {
  const knownProvinces = new Map<string, Set<string>>();
  for (const row of regions) {
    const core = key(parseKota(row.kota).core);
    const province = provinceKey(canonicalProvince(row));
    if (province) {
      const values = knownProvinces.get(core) ?? new Set<string>();
      values.add(province);
      knownProvinces.set(core, values);
    }
  }
  const provinceOf = (row: RegionRow) => {
    const known = knownProvinces.get(key(parseKota(row.kota).core));
    return (
      provinceKey(canonicalProvince(row)) ||
      (known?.size === 1 ? [...known][0] : "UNKNOWN")
    );
  };
  const kinds = new Map<string, Set<string>>();
  for (const row of regions) {
    const parsed = parseKota(row.kota),
      stem = `${provinceOf(row)}:${key(parsed.core)}`;
    if (parsed.tipe) {
      const values = kinds.get(stem) ?? new Set<string>();
      values.add(parsed.tipe);
      kinds.set(stem, values);
    }
  }
  const records = new Map<string, CityRecord>();
  const byRaw = new Map<string, string>();
  for (const row of regions) {
    const parsed = parseKota(row.kota),
      province = provinceOf(row);
    const core = key(parsed.core);
    if (!core) continue;
    const choices = kinds.get(`${province}:${core}`);
    const kind =
      parsed.tipe || (choices?.size === 1 ? [...choices][0] : "UNKNOWN");
    const id = `${province}/${kind}/${core}`;
    const found = records.get(id);
    if (found) found.regions.push(row);
    else
      records.set(id, {
        id,
        name: `${kind === "KOTA" ? "Kota " : kind === "KAB" ? "Kabupaten " : ""}${display(parsed.core ?? row.kota)}`,
        provinceName:
          canonicalProvince(row)?.trim() || "Provinsi belum tercatat",
        regions: [row],
      });
    byRaw.set(rawRegionKey(row), id);
  }
  return {
    records,
    resolve: (row: RegionRow) => byRaw.get(rawRegionKey(row)) ?? null,
  };
}
