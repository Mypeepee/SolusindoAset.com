// src/app/dashboard/listings/lib/property-stats.ts
import prisma from "@/lib/prisma";

export type KategoriEnum =
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "HOTEL_DAN_VILLA"
  | "TOKO"
  | "PABRIK";

export type ListingTypeCounts = Partial<Record<KategoriEnum, number>>;

export type ListingHeaderStats = {
  total: number;
  totalForSale: number;
  totalForRent: number;
  totalHotDeal: number;
  totalViewed: number;
  countsByCategory: ListingTypeCounts;
};

export async function fetchListingHeaderStats(
  userRole: string,
  idAgent?: string,
): Promise<ListingHeaderStats> {
  const baseWhere = userRole === "OWNER"
    ? { status_tayang: "TERSEDIA" as const }
    : {
        id_agent: idAgent!,
        status_tayang: "TERSEDIA" as const,
      };

  // Semua query dijalankan paralel — dari 6 sequential (~180ms) → 1 batch (~30ms)
  const [
    total,
    totalForSale,
    totalForRent,
    totalHotDeal,
    byCategory,
    viewedAgg,
  ] = await Promise.all([
    prisma.listing.count({ where: baseWhere }),

    prisma.listing.count({
      where: { ...baseWhere, jenis_transaksi: { in: ["PRIMARY", "SECONDARY"] } },
    }),

    prisma.listing.count({
      where: { ...baseWhere, jenis_transaksi: "SEWA" },
    }),

    prisma.listing.count({
      where: { ...baseWhere, is_hot_deal: true },
    }),

    prisma.listing.groupBy({
      by: ["kategori"],
      _count: { _all: true },
      where: baseWhere,
    }),

    prisma.listing.aggregate({
      where: baseWhere,
      _sum: { dilihat: true },
    }),
  ]);

  const countsByCategory: ListingTypeCounts = {};
  byCategory.forEach((row) => {
    countsByCategory[row.kategori as KategoriEnum] = row._count._all;
  });

  return {
    total,
    totalForSale,
    totalForRent,
    totalHotDeal,
    totalViewed: viewedAgg._sum.dilihat ?? 0,
    countsByCategory,
  };
}
