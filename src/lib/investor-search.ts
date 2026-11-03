import { ALLOWED_CATEGORIES } from "./propertyType";
import {
  locationsToSelectedRegions,
  normalizeRegionName,
  parseLocationParams,
  setLocationParams,
} from "./regionSearch";
import type {
  DealFilters,
  InvestorListing,
  RentalPeriod,
} from "./investor-deals";

export const INVESTOR_RENTAL_PERIODS = [
  "HARIAN",
  "MINGGUAN",
  "BULANAN",
  "TAHUNAN",
];

/** Home's URL vocabulary is also the Investor search contract. No building-area field. */
export function readInvestorSearch(
  params: URLSearchParams,
  strict = false,
): Partial<DealFilters> {
  const invalid = () => {
    if (strict) throw new Error("INVALID_FILTER");
  };
  const number = (key: string) => {
    const raw = params.get(key);
    if (!raw) return undefined;
    const value = Number(raw);
    if (
      !/^\d+(\.\d+)?$/.test(raw) ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > Number.MAX_SAFE_INTEGER
    ) {
      invalid();
      return undefined;
    }
    return value;
  };
  const rawTypes = (params.get("tipe") || "").split(",").filter(Boolean);
  if (rawTypes.some((type) => !ALLOWED_CATEGORIES.includes(type))) invalid();
  const propertyTypes = [
    ...new Set(rawTypes.filter((type) => ALLOWED_CATEGORIES.includes(type))),
  ];
  const parsed = parseLocationParams((key) => params.get(key));
  if (parsed.kecamatan.length || parsed.kelurahan.length) invalid();
  const locations = locationsToSelectedRegions({
    ...parsed,
    kecamatan: [],
    kelurahan: [],
  });
  if (
    locations.length > 20 ||
    locations.some((region) => region.name.length > 100)
  )
    invalid();
  const rentalPeriod = params.get("durasi") || "";
  if (rentalPeriod && !INVESTOR_RENTAL_PERIODS.includes(rentalPeriod))
    invalid();
  const result: Partial<DealFilters> = {
    locations: locations.slice(0, 20),
    propertyTypes,
    minPrice: number("minHarga"),
    maxPrice: number("maxHarga"),
    minLand: number("minLT"),
    maxLand: number("maxLT"),
    rentalPeriod: INVESTOR_RENTAL_PERIODS.includes(rentalPeriod)
      ? (rentalPeriod as RentalPeriod)
      : "",
  };
  for (const [min, max] of [
    ["minPrice", "maxPrice"],
    ["minLand", "maxLand"],
  ] as const) {
    if (
      result[min] !== undefined &&
      result[max] !== undefined &&
      result[min]! > result[max]!
    ) {
      invalid();
      result[min] = result[max] = undefined;
    }
  }
  return result;
}

export function writeInvestorSearch(
  params: URLSearchParams,
  filters: DealFilters,
) {
  setLocationParams(params, filters.locations || []);
  const cities = filters.locations?.filter((region) => region.level === "kota");
  if (cities?.length)
    params.set("kota", cities.map((region) => region.name).join(","));
  const values = {
    tipe: filters.propertyTypes?.join(","),
    minHarga: filters.minPrice,
    maxHarga: filters.maxPrice,
    minLT: filters.minLand,
    maxLT: filters.maxLand,
    durasi: filters.transactionType === "SEWA" ? filters.rentalPeriod : "",
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
    else params.delete(key);
  }
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");

/** Applied to the complete city/national snapshot BEFORE pagination, without changing CMA peers. */
export function matchesInvestorSearch(
  listing: InvestorListing,
  filters: DealFilters,
) {
  const locations = filters.locations || [];
  const locationMatches =
    !locations.length ||
    locations.some((region) => {
      if (region.level === "provinsi")
        return normalize(listing.provinceName) === normalize(region.name);
      if (region.level !== "kota") return false;
      // Preserve Kota vs Kabupaten when the picker carries the administrative prefix.
      if (/^(kota|kabupaten)\s/i.test(region.name))
        return normalize(listing.cityName) === normalize(region.name);
      return (
        normalize(normalizeRegionName(listing.cityName, "kota")) ===
        normalize(region.name)
      );
    });
  return (
    locationMatches &&
    (!filters.propertyTypes?.length ||
      filters.propertyTypes.includes(listing.propertyType)) &&
    (filters.minPrice === undefined ||
      listing.currentAuctionPrice >= filters.minPrice) &&
    (filters.maxPrice === undefined ||
      listing.currentAuctionPrice <= filters.maxPrice) &&
    (filters.minLand === undefined ||
      (listing.landAreaSqm !== null &&
        listing.landAreaSqm >= filters.minLand)) &&
    (filters.maxLand === undefined ||
      (listing.landAreaSqm !== null &&
        listing.landAreaSqm <= filters.maxLand)) &&
    (filters.transactionType !== "SEWA" ||
      !filters.rentalPeriod ||
      listing.rentalPeriod === filters.rentalPeriod)
  );
}
