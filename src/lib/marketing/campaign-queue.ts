import type { AssetSnapshot } from "./domain";
import type { CampaignBatch } from "./campaign-batches";
import type { CampaignInventoryDiagnostics } from "./campaign-inventory";
export type CampaignQueue = {
  campaignId: string;
  campaignName: string;
  revision: number;
  active: boolean;
  batch: CampaignBatch | null;
  checkedAt: string | null;
  inventory?: {
    diagnostics?: CampaignInventoryDiagnostics;
    eligible: number;
    upcomingSlots: number;
    checkedAt: string;
  } | null;
  inventoryError?: boolean;
  days: {
    date: string;
    slots: {
      scheduledFor: string;
      asset: AssetSnapshot | null;
      status: string;
      reason: string | null;
    }[];
  }[];
};
