// src/lib/auctionMatch.ts
import type { Prisma, sertifikat_enum } from "@prisma/client";

export type AssetMatchInput = {
  kelurahan?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  legalitas?: sertifikat_enum | null;
  nomor_legalitas?: string | null;
};

export type WilayahLevel = "kelurahan" | "kecamatan" | "kota";

const clean = (v?: string | null) => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * Level wilayah administratif terdalam yang tersedia pada aset.
 * Dipakai untuk menentukan seberapa spesifik pencocokan dilakukan.
 */
export function deepestWilayahLevel(current: AssetMatchInput): WilayahLevel {
  if (clean(current.kelurahan)) return "kelurahan";
  if (clean(current.kecamatan)) return "kecamatan";
  return "kota";
}

/**
 * Bangun filter Prisma untuk mencari listing lain yang merupakan **aset yang sama**.
 *
 * Dua aset dianggap identik bila jenis sertifikat + nomor sertifikat sama DAN
 * berada di wilayah administratif yang sama. Nomor sertifikat (SHM/HGB/dst) di
 * Indonesia hanya unik dalam satu kelurahan/desa — jadi pencocokan WAJIB
 * menyertakan kelurahan. Bila kelurahan tidak tersedia pada aset ini, pencocokan
 * turun ke kecamatan, lalu ke kota/kabupaten. Kota selalu ikut dibatasi (bila ada)
 * supaya kelurahan/kecamatan bernama sama di kota berbeda tidak ikut tercocok.
 *
 * Mengembalikan `null` bila aset tidak punya jenis + nomor sertifikat
 * (tidak bisa diidentifikasi sebagai aset unik).
 */
export function buildAssetMatchWhere(
  current: AssetMatchInput
): Prisma.ListingWhereInput | null {
  const legalitas = current.legalitas ?? null;
  const nomor = clean(current.nomor_legalitas);
  if (!legalitas || !nomor) return null;

  const where: Prisma.ListingWhereInput = {
    legalitas,
    nomor_legalitas: { equals: nomor, mode: "insensitive" },
  };

  const kota = clean(current.kota);
  if (kota) where.kota = { equals: kota, mode: "insensitive" };

  const kelurahan = clean(current.kelurahan);
  const kecamatan = clean(current.kecamatan);
  if (kelurahan) {
    where.kelurahan = { equals: kelurahan, mode: "insensitive" };
  } else if (kecamatan) {
    where.kecamatan = { equals: kecamatan, mode: "insensitive" };
  }

  return where;
}
