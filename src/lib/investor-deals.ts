import type { SelectedRegion } from "./regionSearch";
import type { BuyPropertyType } from "./propertyType";
import { matchesInvestorSearch } from "./investor-search";
/** Database feed contracts. Prices are IDR; calculations retain full precision. */
export interface KelurahanBenchmark {
  kelurahanId: string;
  kelurahanName: string;
  cityId: string;
  cityName: string;
  avgPricePerSqm: number;
  sampleCount: number;
  propertyType?: InvestorPropertyType;
  transactionType?: TransactionType;
  rentalPeriod?: RentalPeriod | null;
  scope?: "KELURAHAN" | "KECAMATAN";
  districtId?: string;
  districtName?: string;
  kelurahanSampleCount?: number;
  version?: string;
}
export type InvestorPropertyType = BuyPropertyType;
export interface CmaPeerSample {
  id: string;
  assetCode: string;
  locationSummary: string;
  propertyType: InvestorPropertyType;
  initialAuctionPrice: number;
  landAreaSqm: number;
  baselinePricePerSqm: number;
  listingUrl: string;
  updatedAt: string;
  listingCategory?: ListingCategory | null;
  transactionType?: TransactionType;
  rentalPeriod?: RentalPeriod | null;
  /** Canonical source photo. Missing photos keep the neutral placeholder. */
  imageUrl?: string;
}
export interface CmaValidationProof {
  listing: InvestorListing;
  benchmark: KelurahanBenchmark | null;
  kelurahanSampleCount: number;
  expandedToDistrict: boolean;
  samples: CmaPeerSample[];
  /** Full eligible peer pool, excluding the target; never derived from the table slice. */
  minBaselinePricePerSqm?: number | null;
  cheapestPeer?: CmaPeerSample | null;
  generatedAt: string;
  version: string;
}
export type TransactionType = "BELI" | "SEWA";
export type ListingCategory = "PRIMARY" | "LELANG" | "SECONDARY";
export type PropertyType = InvestorPropertyType;
export type RentalPeriod = "HARIAN" | "MINGGUAN" | "BULANAN" | "TAHUNAN";
/** Storage contract for complete auction records. Non-auction/rental boundary
 * records preserve absent auction fields as null instead of inventing a price. */
export interface ListingProperty {
  id: string;
  asset_code: string;
  title: string;
  transaction_type: TransactionType;
  listing_category: ListingCategory;
  property_type: PropertyType;
  city_id: string;
  city_name: string;
  kelurahan_id: string | null;
  kelurahan_name: string | null;
  harga_lelang_pertama: number;
  harga_lelang_terakhir: number;
  luas_tanah_m2: number;
  harga_per_meter: number;
  is_latest: boolean;
  updated_at: string;
}
export interface AuctionHistoryPoint {
  round: number;
  price: number;
  date: string;
  dropPercentageFromInitial: number;
}
export const rentalPeriodLabel = (period: RentalPeriod | null | undefined) =>
  ({ HARIAN: "hari", MINGGUAN: "minggu", BULANAN: "bulan", TAHUNAN: "tahun" })[
    period as RentalPeriod
  ] || "periode belum terverifikasi";
export const hasVerifiedKelurahan = (
  listing: Pick<InvestorListing, "kelurahanId" | "kelurahanName">,
) =>
  Boolean(
    listing.kelurahanId &&
    listing.kelurahanName?.trim() &&
    !listing.kelurahanId.endsWith("/UNKNOWN"),
  );
export interface CompleteListingProperty {
  id: string;
  title: string;
  cityId: string;
  cityName: string;
  kelurahanId: string;
  kelurahanName: string;
  initialAuctionPrice: number;
  currentAuctionPrice: number;
  landAreaSqm: number;
  pricePerSqm: number;
  imageUrl: string;
  auctionRound: number;
  auctionDate: string;
}
export interface AnalyzedDealListing extends CompleteListingProperty {
  metricAuctionDropPct: number;
  metricMarketSpreadPct: number;
  primaryDealScore: number;
  primaryDealType: "AUCTION_DROP" | "MARKET_SPREAD";
}
export interface AuctionHistory {
  round: number;
  date: string | null;
  limitPrice: number;
}
/** A database can lack evidence for one driver. JSON null means unknown, never 0%.
 * Complete records satisfy AnalyzedDealListing; this boundary type also preserves
 * incomplete records which may qualify through the other side of the OR. */
export type InvestorListing = Omit<
  AnalyzedDealListing,
  | "kelurahanId"
  | "kelurahanName"
  | "initialAuctionPrice"
  | "landAreaSqm"
  | "pricePerSqm"
  | "auctionDate"
  | "metricAuctionDropPct"
  | "metricMarketSpreadPct"
  | "primaryDealScore"
  | "primaryDealType"
> & {
  initialAuctionPrice: number | null;
  landAreaSqm: number | null;
  pricePerSqm: number | null;
  auctionDate: string | null;
  metricAuctionDropPct: number | null;
  metricMarketSpreadPct: number | null;
  primaryDealScore: number | null;
  primaryDealType: AnalyzedDealListing["primaryDealType"] | null;
  benchmark: KelurahanBenchmark | null;
  provinceName: string;
  districtName: string;
  address: string;
  /** Source photo references in stored order; individual photos may be unavailable. */
  imageUrls?: string[];
  /** Source legalitas enum only; certificate numbers are never exposed here. */
  certificateType?: string | null;
  propertyType: InvestorPropertyType;
  transactionType?: TransactionType;
  listingCategory?: ListingCategory | null;
  rentalPeriod?: RentalPeriod | null;
  kelurahanId: string | null;
  kelurahanName: string | null;
  kelurahanVerified?: boolean;
  sourceRevision?: string;
  sourceListedAt?: string | null;
  auctionHistoryPoints?: (Omit<
    AuctionHistoryPoint,
    "date" | "dropPercentageFromInitial"
  > & {
    date: string | null;
    dropPercentageFromInitial: number | null;
    sourceListingId?: string;
    sourceListingUrl?: string;
  })[];
  listingUrl: string;
  status: string;
  coordinates: { latitude: number; longitude: number } | null;
  auctionHistory: AuctionHistory[];
  assetCode?: string;
  identityVerified?: boolean;
  districtId?: string;
  baselinePricePerSqm?: number | null;
  kelurahanSampleCount?: number;
  benchmarkExpanded?: boolean;
  benchmarkVersion?: string;
};
export type UnanalyzedListing = Omit<
  InvestorListing,
  | "pricePerSqm"
  | "metricAuctionDropPct"
  | "metricMarketSpreadPct"
  | "primaryDealScore"
  | "primaryDealType"
  | "benchmark"
>;
export interface DealMetrics {
  pricePerSqm: number | null;
  marketSpread: number | null;
  auctionDrop: number | null;
  firstAuctionPrice: number | null;
  primaryScore: number | null;
  primaryType: InvestorListing["primaryDealType"];
  benchmark: KelurahanBenchmark | null;
}
export type DealSort = "score" | "spread" | "drop" | "price";
export type DealView = "grid" | "table" | "map";
export type DealDiscountMode = "either" | "market" | "auction";
export interface DealFilters {
  locations?: SelectedRegion[];
  propertyTypes?: string[];
  minPrice?: number;
  maxPrice?: number;
  minLand?: number;
  maxLand?: number;
  rentalPeriod?: RentalPeriod | "";
  transactionType?: TransactionType;
  listingCategory?: ListingCategory | "ALL";
  dataState?: "deals" | "all" | "unverified";
  city: string;
  query: string;
  minSpread: number;
  minDrop: number;
  discountMode?: DealDiscountMode;
  sort: DealSort;
  savedOnly: boolean;
  upcomingOnly: boolean;
}
/** Rental URLs must not retain hidden buy-category/auction constraints. */
export function isolateTransactionFilters(filters: DealFilters): DealFilters {
  return filters.transactionType === "SEWA"
    ? {
        ...filters,
        listingCategory: "ALL",
        upcomingOnly: false,
        sort: filters.sort === "drop" ? "score" : filters.sort,
      }
    : filters;
}
export interface InvestorCity {
  id: string;
  name: string;
  provinceName: string;
}
export interface InvestorFeed {
  items: InvestorListing[];
  cities: InvestorCity[];
  locations: string[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  generatedAt: string;
  cityId: string;
  summary: {
    missingKelurahanCount?: number;
    rentalPeriodMissingCount?: number;
    activeListings: number;
    /** Matches every applied filter except the Worth-it discount thresholds. */
    matchingListingsCount?: number;
    worthItCount: number;
    avgMarketSpread: number | null;
    benchmarkCoverage: number;
    historyCoverage: number;
    unscoredCount: number;
    pastScheduleCount: number;
    topDeal: InvestorListing | null;
    /** Highest-ranked qualifying assets before result pagination (maximum five). */
    suggestedDeals?: InvestorListing[];
  };
}
export const DEFAULT_DEAL_THRESHOLD = 25;
export const INVESTOR_PAGE_SIZE = 30;

/** Signed percentage points. Missing evidence is omitted, never invented as 0%. */
export function combinedDealScore(
  auction: number | null,
  market: number | null,
): number | null {
  const known = [auction, market].filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}
export const positiveNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");
const listingIdOrder = new Intl.Collator("en", { numeric: true });
const discount = (reference: number | null, current: number | null) => {
  if (reference === null || current === null) return null;
  const value = ((reference - current) / reference) * 100;
  return Number.isFinite(value) ? value : null;
};
export function analyzeListing(
  listing: UnanalyzedListing,
  benchmark: KelurahanBenchmark | null,
): InvestorListing {
  const price = positiveNumber(listing.currentAuctionPrice);
  const land = positiveNumber(listing.landAreaSqm);
  const ratio = price !== null && land !== null ? price / land : null;
  const pricePerSqm = ratio !== null && Number.isFinite(ratio) ? ratio : null;
  const validBenchmark =
    benchmark &&
    benchmark.scope !== "KECAMATAN" &&
    hasVerifiedKelurahan(listing) &&
    (!benchmark.transactionType ||
      benchmark.transactionType === (listing.transactionType || "BELI")) &&
    ((listing.transactionType || "BELI") !== "SEWA" ||
      Boolean(
        listing.rentalPeriod && benchmark.rentalPeriod === listing.rentalPeriod,
      )) &&
    benchmark.cityId === listing.cityId &&
    benchmark.kelurahanId === listing.kelurahanId &&
    (!benchmark.propertyType ||
      benchmark.propertyType === listing.propertyType) &&
    positiveNumber(benchmark.avgPricePerSqm) !== null &&
    Number.isInteger(benchmark.sampleCount) &&
    benchmark.sampleCount > 0
      ? benchmark
      : null;
  const auction =
    (listing.transactionType || "BELI") === "BELI" &&
    (!listing.listingCategory || listing.listingCategory === "LELANG")
      ? discount(positiveNumber(listing.initialAuctionPrice), price)
      : null;
  const market = discount(validBenchmark?.avgPricePerSqm ?? null, pricePerSqm);
  const score = combinedDealScore(auction, market);
  return {
    ...listing,
    pricePerSqm,
    benchmark: validBenchmark,
    metricAuctionDropPct: auction,
    metricMarketSpreadPct: market,
    primaryDealScore: score,
    // Stable tie-break: an equal auction driver wins; no unknown metric is padded with zero.
    primaryDealType:
      score === null
        ? null
        : auction !== null && (market === null || auction >= market)
          ? "AUCTION_DROP"
          : "MARKET_SPREAD",
  };
}
export function isWorthItDeal(
  listing: InvestorListing,
  thresholdAuction: number,
  thresholdMarket: number,
  mode: DealDiscountMode = "either",
) {
  return (
    (mode !== "market" &&
      Number.isFinite(listing.metricAuctionDropPct) &&
      listing.metricAuctionDropPct !== null &&
      listing.metricAuctionDropPct >= thresholdAuction) ||
    (mode !== "auction" &&
      Number.isFinite(listing.metricMarketSpreadPct) &&
      listing.metricMarketSpreadPct !== null &&
      listing.metricMarketSpreadPct >= thresholdMarket)
  );
}
export function jakartaDayStart(now = new Date()) {
  const shifted = new Date(now.getTime() + 7 * 3_600_000);
  return (
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) -
    7 * 3_600_000
  );
}
export function selectDeals(
  listings: readonly InvestorListing[],
  filters: DealFilters,
  savedIds: readonly string[] = [],
  now = new Date(),
) {
  filters = isolateTransactionFilters(filters);
  const query = filters.query.trim();
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const numericQuery = /^\d+$/.test(query);
  const saved = filters.savedOnly ? new Set(savedIds) : null;
  const dayStart = filters.upcomingOnly ? jakartaDayStart(now) : 0;
  const matchesText = (listing: InvestorListing) => {
    if (!query) return true;
    if (numericQuery) return listing.id === query;
    const text = normalize(
      [
        listing.title,
        listing.address,
        listing.id,
        listing.cityName,
        listing.districtName,
        listing.kelurahanName,
      ].join(" "),
    );
    return words.every((word) => text.includes(word));
  };
  const sortValue = (item: InvestorListing) =>
    filters.sort === "drop"
      ? item.metricAuctionDropPct
      : filters.sort === "spread"
        ? item.metricMarketSpreadPct
        : filters.sort === "price"
          ? item.pricePerSqm
          : item.primaryDealScore;
  return listings
    .filter((listing) => {
      return (
        (listing.transactionType || "BELI") ===
          (filters.transactionType || "BELI") &&
        (!filters.listingCategory ||
          filters.listingCategory === "ALL" ||
          listing.listingCategory === filters.listingCategory) &&
        (filters.dataState !== "unverified" ||
          !hasVerifiedKelurahan(listing)) &&
        (!(filters.city && !filters.locations?.length) ||
          listing.cityId === filters.city) &&
        matchesInvestorSearch(listing, filters) &&
        matchesText(listing) &&
        ((filters.dataState && filters.dataState !== "deals") ||
          isWorthItDeal(
            listing,
            filters.minDrop,
            filters.minSpread,
            filters.discountMode,
          )) &&
        (!saved || saved.has(listing.id)) &&
        (!filters.upcomingOnly ||
          (listing.auctionDate !== null &&
            Date.parse(listing.auctionDate) >= dayStart))
      );
    })
    .sort((a, b) => {
      const av = sortValue(a),
        bv = sortValue(b);
      if (av === null && bv !== null) return 1;
      if (bv === null && av !== null) return -1;
      return (
        (av !== null && bv !== null
          ? filters.sort === "price"
            ? av - bv
            : bv - av
          : 0) ||
        (b.primaryDealScore ?? -Infinity) - (a.primaryDealScore ?? -Infinity) ||
        listingIdOrder.compare(a.id, b.id)
      );
    });
}
export function calculateDealMetrics(listing: InvestorListing): DealMetrics {
  return {
    pricePerSqm: listing.pricePerSqm,
    marketSpread: listing.metricMarketSpreadPct,
    auctionDrop: listing.metricAuctionDropPct,
    firstAuctionPrice: listing.initialAuctionPrice,
    primaryScore: listing.primaryDealScore,
    primaryType: listing.primaryDealType,
    benchmark: listing.benchmark,
  };
}
export const toDealView = (listing: InvestorListing) => ({
  listing,
  metrics: calculateDealMetrics(listing),
});
export type DealViewItem = ReturnType<typeof toDealView>;
export function auctionScheduleLabel(
  listing: Pick<InvestorListing, "auctionDate">,
  now = new Date(),
) {
  return !listing.auctionDate
    ? "Jadwal belum tercatat"
    : Date.parse(listing.auctionDate) < jakartaDayStart(now)
      ? "Jadwal perlu diperbarui"
      : "Tersedia";
}
export function calculateRoi(
  purchasePrice: number,
  resalePrice: number,
  additionalCosts: number,
) {
  if (
    positiveNumber(purchasePrice) === null ||
    positiveNumber(resalePrice) === null ||
    !Number.isFinite(additionalCosts) ||
    additionalCosts < 0
  )
    return null;
  const totalInvestment = purchasePrice + additionalCosts;
  const profit = resalePrice - totalInvestment;
  const roi = (profit / totalInvestment) * 100;
  return Number.isFinite(totalInvestment) && Number.isFinite(roi)
    ? { totalInvestment, profit, roi }
    : null;
}
const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const compactNumber = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});
export const formatRupiah = (value: number) => currency.format(value);
export const formatCompactRupiah = (value: number) =>
  Math.abs(value) >= 1e9
    ? `Rp ${compactNumber.format(value / 1e9)} M`
    : Math.abs(value) >= 1e6
      ? `Rp ${compactNumber.format(value / 1e6)} jt`
      : formatRupiah(value);
export const formatPercent = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
export const formatAuctionDate = (value: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(
        new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value),
      )
    : "Jadwal belum tersedia";
