import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // distinct sederhana (buat versi awal)
  const [vendors, provinsi, kota, kecamatan, kelurahan] = await Promise.all([
    prisma.listing.findMany({ distinct: ["vendor"], select: { vendor: true }, where: { vendor: { not: null } }, take: 500 }),
    prisma.listing.findMany({ distinct: ["provinsi"], select: { provinsi: true }, where: { provinsi: { not: null } }, take: 500 }),
    prisma.listing.findMany({ distinct: ["kota"], select: { kota: true }, take: 500 }),
    prisma.listing.findMany({ distinct: ["kecamatan"], select: { kecamatan: true }, where: { kecamatan: { not: null } }, take: 500 }),
    prisma.listing.findMany({ distinct: ["kelurahan"], select: { kelurahan: true }, where: { kelurahan: { not: null } }, take: 500 }),
  ]);

  const clean = (arr: Array<string | null | undefined>) =>
    Array.from(new Set(arr.filter(Boolean).map((x) => String(x).trim()))).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    vendors: clean(vendors.map((x) => x.vendor)),
    provinsi: clean(provinsi.map((x) => x.provinsi)),
    kota: clean(kota.map((x) => x.kota)),
    kecamatan: clean(kecamatan.map((x) => x.kecamatan)),
    kelurahan: clean(kelurahan.map((x) => x.kelurahan)),
  });
}