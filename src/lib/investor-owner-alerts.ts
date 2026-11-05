import {
  jakartaDayStart,
  type DealFilters,
  type InvestorListing,
} from "./investor-deals";

export const INVESTOR_ALERT_THRESHOLD = 60;
export const INVESTOR_ALERT_BATCH_SIZE = 6;
export const INVESTOR_ALERT_COOLDOWN_MS = 60 * 60_000;
export const INVESTOR_ALERT_MAX_ATTEMPTS = 5;

/** Owner alerts use only the canonical auction-history driver, before display rounding. */
export function qualifiesForOwnerAlert(listing: InvestorListing, now = new Date()) {
  const drop = listing.metricAuctionDropPct;
  return (
    listing.transactionType === "BELI" &&
    listing.listingCategory === "LELANG" &&
    listing.status === "TERSEDIA" &&
    listing.initialAuctionPrice !== null &&
    Number.isFinite(listing.initialAuctionPrice) &&
    Number.isFinite(listing.currentAuctionPrice) &&
    listing.initialAuctionPrice > 0 &&
    listing.currentAuctionPrice > 0 &&
    drop !== null && Number.isFinite(drop) && drop > INVESTOR_ALERT_THRESHOLD &&
    Boolean(listing.auctionDate) &&
    Date.parse(listing.auctionDate!) >= jakartaDayStart(now)
  );
}

export function ownerAlertAssetKey(listing: InvestorListing) {
  return listing.assetCode ? `asset:${listing.assetCode}` : `listing:${listing.id}`;
}

export function ownerAlertDropLabel(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return rounded <= 60 && value > 60
    ? "> 60%"
    : `${rounded.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

export const OWNER_ALERT_FILTERS: DealFilters = {
  transactionType: "BELI",
  listingCategory: "LELANG",
  query: "",
  city: "",
  sort: "drop",
  dataState: "all",
  minDrop: INVESTOR_ALERT_THRESHOLD,
  minSpread: 100,
  savedOnly: false,
  upcomingOnly: false,
};
