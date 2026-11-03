import { combinedDealScore } from "@/lib/investor-deals";
import type { Prisma } from "@prisma/client";
import type {
  InvestorListing,
  KelurahanBenchmark,
  InvestorPropertyType,
  TransactionType,
  ListingCategory,
  RentalPeriod,
} from "@/lib/investor-deals";
export type Numeric = Prisma.Decimal | string | number;
export interface ListingRow {
  id: string;
  asset_code: string;
  source_listing_id: bigint;
  identity_verified: boolean;
  city_id: string;
  city_name: string;
  province_name: string;
  district_id: string;
  district_name: string;
  kelurahan_id: string | null;
  kelurahan_name: string | null;
  property_type: InvestorPropertyType;
  harga_lelang_pertama: Numeric | null;
  harga_lelang_terakhir: Numeric;
  luas_tanah_m2: Numeric | null;
  harga_per_meter: Numeric | null;
  current_price_per_meter: Numeric | null;
  initial_source_id: bigint | null;
  initial_auction_date: Date | null;
  auction_round: number;
  metric_auction_drop_pct: Numeric | null;
  metric_market_spread_pct: Numeric | null;
  primary_deal_score: Numeric | null;
  primary_deal_type: InvestorListing["primaryDealType"];
  benchmark_avg: Numeric | null;
  benchmark_count: number;
  kelurahan_sample_count: number;
  benchmark_scope: "KELURAHAN" | "KECAMATAN" | "NONE";
  benchmark_version: Date;
  judul: string;
  slug: string;
  alamat_lengkap: string | null;
  gambar: string | null;
  transaction_type: TransactionType;
  listing_category: ListingCategory | null;
  rental_period: RentalPeriod | null;
  market_basis_per_meter: Numeric | null;
  market_eligible: boolean;
  source_revision: string;
  latitude: Numeric | null;
  longitude: Numeric | null;
  tanggal_lelang: Date | null;
  auction_initial_price?: number | null;
  history_raw_price?: Numeric | null;
  history_raw_limit?: Numeric | null;
  history_legalitas?: string | null;
  certificate_type?: string | null;
  history_nomor_legalitas?: string | null;
  history_city_name?: string | null;
  history_created_at?: Date | null;
  history?: {
    date: string | null;
    price: number;
    id?: string;
    slug?: string;
    round?: number;
  }[];
}

export const number = (v: unknown) =>
  v === null || v === undefined ? null : Number(v);
export const iso = (v: Date | string) => new Date(v).toISOString();
export function investorPhotoUrls(raw: string | null, id: string): string[] {
  const seen = new Set<string>();
  const photos = (raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 50);
  const urls = photos.flatMap((photo, index) => {
    if (seen.has(photo)) return [];
    seen.add(photo);
    if (photo.startsWith("/") && !photo.startsWith("//")) return [photo];
    if (/^[\w-]+$/.test(photo))
      return [`/api/drive-image?id=${encodeURIComponent(photo)}&sz=w800`];
    if (!/^https?:\/\//i.test(photo)) return [];
    try {
      const url = new URL(photo);
      if (
        ["drive.google.com", "drive.usercontent.google.com"].includes(
          url.hostname,
        )
      ) {
        const driveId =
          url.searchParams.get("id") ||
          url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1];
        if (driveId && /^[\w-]+$/.test(driveId))
          return [`/api/drive-image?id=${encodeURIComponent(driveId)}&sz=w800`];
      }
      // The source-index proxy retains each genuine photo and its original ratio.
      return [`/api/foto/${id}?w=640&view=card&index=${index}`];
    } catch {
      return [];
    }
  });
  return [...new Set(urls)];
}
export function serializeInvestorListing(
  row: ListingRow,
  includeDetails = true,
): InvestorListing {
  const photos = includeDetails ? investorPhotoUrls(row.gambar, row.id) : [];
  const history = includeDetails ? row.history || [] : [];
  const benchmark: KelurahanBenchmark | null =
    row.benchmark_avg === null ||
    row.benchmark_scope !== "KELURAHAN" ||
    row.benchmark_count < 1 ||
    !row.market_eligible ||
    !row.kelurahan_id ||
    !row.kelurahan_name
      ? null
      : {
          cityId: row.city_id,
          cityName: row.city_name,
          kelurahanId: row.kelurahan_id,
          kelurahanName: row.kelurahan_name,
          districtId: row.district_id,
          districtName: row.district_name,
          propertyType: row.property_type,
          transactionType: row.transaction_type,
          rentalPeriod: row.rental_period,
          scope: "KELURAHAN",
          avgPricePerSqm: Number(row.benchmark_avg),
          sampleCount: row.benchmark_count,
          kelurahanSampleCount: row.kelurahan_sample_count,
          version: iso(row.benchmark_version),
        };
  const latitude = number(row.latitude),
    longitude = number(row.longitude);
  const auction = number(row.metric_auction_drop_pct);
  const market = benchmark ? number(row.metric_market_spread_pct) : null;
  const score = combinedDealScore(auction, market);
  return {
    id: row.id,
    assetCode: row.asset_code,
    identityVerified: row.identity_verified,
    title: row.judul,
    cityId: row.city_id,
    cityName: row.city_name,
    kelurahanId: row.kelurahan_id,
    kelurahanName: row.kelurahan_name,
    districtId: row.district_id,
    districtName: row.district_name,
    provinceName: row.province_name,
    propertyType: row.property_type,
    certificateType: row.certificate_type ?? row.history_legalitas ?? null,
    address: row.alamat_lengkap || "",
    initialAuctionPrice:
      row.auction_initial_price !== undefined
        ? row.auction_initial_price
        : number(row.harga_lelang_pertama),
    currentAuctionPrice: Number(row.harga_lelang_terakhir),
    landAreaSqm: number(row.luas_tanah_m2),
    transactionType: row.transaction_type,
    listingCategory: row.listing_category,
    rentalPeriod: row.rental_period,
    kelurahanVerified: Boolean(row.kelurahan_id && row.kelurahan_name),
    sourceRevision: row.source_revision,
    pricePerSqm: number(row.current_price_per_meter),
    baselinePricePerSqm: number(row.market_basis_per_meter),
    imageUrl: photos[0] || "",
    imageUrls: photos,
    auctionRound: row.auction_round,
    auctionDate: row.tanggal_lelang ? iso(row.tanggal_lelang) : null,
    metricAuctionDropPct: auction,
    metricMarketSpreadPct: market,
    // Recompute at the boundary so a pre-SUM storage snapshot cannot restore MAX ranking.
    primaryDealScore: score,
    primaryDealType:
      score === null
        ? null
        : auction !== null && (market === null || auction >= market)
          ? "AUCTION_DROP"
          : "MARKET_SPREAD",
    benchmark,
    benchmarkVersion: iso(row.benchmark_version),
    kelurahanSampleCount: row.kelurahan_sample_count,
    benchmarkExpanded: false,
    listingUrl:
      row.transaction_type === "SEWA" && !row.listing_category
        ? `/Sewa/${encodeURIComponent(row.slug)}-${row.id}`
        : row.listing_category === "LELANG"
          ? `/Lelang/${encodeURIComponent(row.slug)}-${row.id}`
          : `/Jual/${encodeURIComponent(row.slug)}-${row.id}`,
    auctionHistoryPoints: history.map((event, i) => ({
      round: event.round || i + 1,
      sourceListingId: event.id,
      sourceListingUrl:
        event.id && event.slug
          ? `/Lelang/${encodeURIComponent(event.slug)}-${event.id}`
          : undefined,
      date: event.date,
      price: Number(event.price),
      dropPercentageFromInitial:
        (row.auction_initial_price ?? row.harga_lelang_pertama)
          ? ((Number(row.auction_initial_price ?? row.harga_lelang_pertama) -
              Number(event.price)) /
              Number(row.auction_initial_price ?? row.harga_lelang_pertama)) *
            100
          : 0,
    })),
    status: "TERSEDIA",
    coordinates:
      latitude !== null &&
      longitude !== null &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180 &&
      (latitude !== 0 || longitude !== 0)
        ? { latitude, longitude }
        : null,
    auctionHistory: history.map((event, i: number) => ({
      round: event.round || i + 1,
      sourceListingId: event.id,
      sourceListingUrl:
        event.id && event.slug
          ? `/Lelang/${encodeURIComponent(event.slug)}-${event.id}`
          : undefined,
      date: event.date,
      limitPrice: Number(event.price),
    })),
  };
}
