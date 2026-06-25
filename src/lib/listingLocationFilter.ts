import { Prisma } from "@prisma/client";
import {
  normalizeRegionName,
  parseLocationsFromSearchParams,
  REGION_LEVELS,
  type RegionLevel,
} from "./regionSearch";

/**
 * Builder filter lokasi multi-wilayah untuk query Listing.
 *
 * Membaca param `provinsi`, `kota`, `kecamatan`, `kelurahan` (masing-masing
 * boleh berisi banyak nilai dipisah koma) lalu menyusun satu grup OR (union):
 * sebuah listing cocok bila SALAH SATU wilayah terpilih cocok. Tiap nama
 * dinormalisasi lebih dulu (belt-and-suspenders) sehingga walau URL berasal
 * dari link lama yang belum dinormalisasi, prefix "Kota/Kabupaten" tetap
 * dibereskan agar cocok dengan format nilai di DB.
 *
 * Memakai `contains` (bukan `equals`) agar tahan terhadap selisih prefix/casing
 * antara data geocoder (DB) dan dataset wilayah (ibnux).
 */

const LEVEL_TO_FIELD: Record<RegionLevel, keyof Prisma.ListingWhereInput> = {
  provinsi: "provinsi",
  kota: "kota",
  kecamatan: "kecamatan",
  kelurahan: "kelurahan",
};

export function buildLocationWhere(searchParams: {
  [key: string]: string | string[] | undefined;
}): Prisma.ListingWhereInput | undefined {
  const parsed = parseLocationsFromSearchParams(searchParams);

  const or: Prisma.ListingWhereInput[] = [];
  for (const level of REGION_LEVELS) {
    const field = LEVEL_TO_FIELD[level];
    for (const rawName of parsed[level]) {
      const name = normalizeRegionName(rawName, level);
      if (!name) continue;
      or.push({
        [field]: { contains: name, mode: "insensitive" },
      } as Prisma.ListingWhereInput);
    }
  }

  if (or.length === 0) return undefined;
  return { OR: or };
}
