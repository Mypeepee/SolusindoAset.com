import {
  hasVerifiedKelurahan,
  isWorthItDeal,
  type InvestorListing,
} from "@/lib/investor-deals";
import type { MarketingSelectionConfig } from "./domain";
import { AUCTION_LEAD_HOURS } from "./campaign-selection";

export type CampaignInventoryDiagnostics = {
  total: number;
  ready: number;
  expired: number;
  closingSoon: number;
  missingAuctionDate: number;
  unverified: number;
  missingEvidence: number;
  belowThreshold: number;
  unavailable: number;
  missingPhotos: number;
  alreadyMarketed: number;
  reserved: number;
  latestAuctionDate: string | null;
};

/** Disjoint reasons over the full geographic/type/price scope, before pagination. */
export function diagnoseCampaignInventory(
  source: readonly InvestorListing[],
  config: MarketingSelectionConfig,
  ready: number,
  when = new Date(),
  alreadyMarketed = 0,
  reserved = 0,
): CampaignInventoryDiagnostics {
  const counts: CampaignInventoryDiagnostics = {
    total: source.length,
    ready,
    expired: 0,
    closingSoon: 0,
    missingAuctionDate: 0,
    unverified: 0,
    missingEvidence: 0,
    belowThreshold: 0,
    unavailable: 0,
    missingPhotos: 0,
    alreadyMarketed,
    reserved,
    latestAuctionDate: null,
  };
  let qualified = 0,
    latest = -Infinity;
  for (const item of source) {
    const auction = Date.parse(item.auctionDate || "");
    if (item.listingCategory === "LELANG" && Number.isFinite(auction))
      latest = Math.max(latest, auction);
    if (
      item.status !== "TERSEDIA" ||
      item.transactionType === "SEWA" ||
      !Number.isFinite(item.currentAuctionPrice) ||
      item.currentAuctionPrice <= 0
    ) {
      counts.unavailable++;
      continue;
    }
    if (item.listingCategory === "LELANG") {
      if (!Number.isFinite(auction)) {
        counts.missingAuctionDate++;
        continue;
      }
      if (auction <= when.getTime()) {
        counts.expired++;
        continue;
      }
      if (auction - when.getTime() < AUCTION_LEAD_HOURS * 3600000) {
        counts.closingSoon++;
        continue;
      }
    }
    if (!hasVerifiedKelurahan(item)) {
      counts.unverified++;
      continue;
    }
    if (
      !isWorthItDeal(
        item,
        config.minDrop,
        config.minSpread,
        config.discountMode,
      )
    ) {
      const mode = config.discountMode || "either";
      const known =
        (mode !== "auction" && Number.isFinite(item.metricMarketSpreadPct)) ||
        (mode !== "market" && Number.isFinite(item.metricAuctionDropPct));
      if (known) counts.belowThreshold++;
      else counts.missingEvidence++;
      continue;
    }
    qualified++;
  }
  counts.missingPhotos = Math.max(
    0,
    qualified - ready - alreadyMarketed - reserved,
  );
  counts.latestAuctionDate = Number.isFinite(latest)
    ? new Date(latest).toISOString()
    : null;
  return counts;
}
