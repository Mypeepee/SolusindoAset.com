import type { InvestorListing } from "@/lib/investor-deals";
import {
  eligibleAsset,
  jakartaDate,
  snapshotAsset,
  type MarketingSelectionConfig,
} from "./domain";
import type { CampaignArchive, CampaignBrief } from "./campaign";
import {
  AUCTION_LEAD_DAYS,
  campaignAssetAvailable,
} from "./campaign-selection";

/** Historical view only: source dates/facts and current filter thresholds remain intact. */
export function latestCampaignArchive(
  source: readonly InvestorListing[],
  config: MarketingSelectionConfig,
): CampaignArchive | undefined {
  const candidates = source
    .filter(
      (item) =>
        item.listingCategory === "LELANG" &&
        eligibleAsset(item, config, new Date(0)),
    )
    .map(snapshotAsset)
    .filter((asset) => asset.images.length > 0)
    .sort(
      (a, b) =>
        Date.parse(b.auctionDate!) - Date.parse(a.auctionDate!) ||
        Date.parse(b.sourceListedAt || "1970-01-01") -
          Date.parse(a.sourceListedAt || "1970-01-01"),
    );
  if (!candidates.length) return;
  const newest = candidates.slice(0, 6);
  const latestAuctionDate = newest[0].auctionDate!;
  // The example day precedes this small newest batch, preserving every actual deadline.
  const day = jakartaDate(
    new Date(
      Date.parse(newest.at(-1)!.auctionDate!) -
        (AUCTION_LEAD_DAYS + 1) * 86400000,
    ),
  );
  const asOf = new Date(day + "T00:00:00+07:00").toISOString();
  const assets = newest
    .filter((asset) => campaignAssetAvailable(asset, new Date(asOf)))
    .slice(0, 6);
  return assets.length ? { asOf, latestAuctionDate, assets } : undefined;
}

export function archiveCampaignBrief(
  brief: CampaignBrief,
  archive: CampaignArchive,
): CampaignBrief {
  const day = jakartaDate(new Date(archive.asOf));
  return {
    ...brief,
    startDate: day,
    endDate: day,
    listingIds: archive.assets.map((asset) => asset.id),
    assetOrder: "manual",
  };
}
