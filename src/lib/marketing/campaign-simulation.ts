import type { MarketingJob, Prisma } from "@prisma/client";
import { DEFAULT_CONFIG, jakartaDate, type AssetSnapshot } from "./domain";
import {
  campaignBriefSchema,
  campaignCriteria,
  campaignSchedule,
  type CampaignBrief,
} from "./campaign";
import { selectCampaignAssets } from "./campaign-selection";

export const SIMULATION_CAMPAIGN_ID = "00000000-0000-4000-8000-000000000001";
const PROPOSAL_ID = "00000000-0000-4000-8000-000000000002";
const DAY = 86400000;
export const simulationCovers = [
  "example-home.jpg",
  "example-warehouse.jpg",
  "example-business.jpg",
];

/** Explicit example stock, never stored as listings or passed to a publication API. */
export function simulationAssets(day: string): AssetSnapshot[] {
  const base = Date.parse(day + "T00:00:00+07:00");
  return [
    {
      name: "A",
      auctionDays: 10,
      type: "RUMAH",
      photos: ["unimas2.jpg", "unimas3.jpg"],
      price: 450e6,
      spread: 35,
      drop: 55,
    },
    {
      name: "B",
      auctionDays: 12,
      type: "GUDANG",
      photos: ["kedinding1.jpg", "kedinding2.jpg"],
      price: 600e6,
      spread: 30,
      drop: 60,
    },
    {
      name: "C",
      auctionDays: 30,
      type: "GUDANG",
      photos: ["pasinan1.jpg", "pasinan2.jpg"],
      price: 750e6,
      spread: 28,
      drop: 50,
    },
  ].map((item, i) => ({
    id: String(900000001 + i),
    assetKey: "simulation:" + item.name,
    title: "Aset " + item.name,
    address:
      "Aset " +
      item.name +
      (item.type === "RUMAH" ? " · rumah contoh" : " · gudang contoh"),
    city: "Sidoarjo (simulasi)",
    price: item.price,
    landArea: 120,
    category: "LELANG",
    propertyType: item.type,
    auctionDate: new Date(base + item.auctionDays * DAY).toISOString(),
    sourceListedAt: new Date(base - (i + 1) * DAY).toISOString(),
    listingUrl: "",
    images: item.photos.map((photo) => "/images/hero/" + photo),
    revision: "simulation",
    marketSpreadPct: item.spread,
    auctionDropPct: item.drop,
  }));
}

export function simulationBrief(day = jakartaDate()): CampaignBrief {
  return {
    name: "Campaign contoh A, B, C",
    startDate: day,
    endDate: day,
    schedules: ["09:00", "13:00", "18:00"],
    listingIds: simulationAssets(day).map((asset) => asset.id),
    assetOrder: "fresh",
    channels: ["instagram", "whatsapp"],
    city: "",
    locations: [],
    category: "LELANG",
    propertyTypes: ["RUMAH", "GUDANG"],
    minPrice: null,
    maxPrice: null,
    minSpread: 25,
    minDrop: 50,
    discountMode: "either",
  };
}

/** Same schedule, freshness, auction expiry and cooldown rules as saved proposals. */
export function projectSimulation(
  brief: CampaignBrief,
  assets = simulationAssets(brief.startDate),
  source: "example" | "archive" = "example",
) {
  const parsed = campaignBriefSchema.safeParse(brief);
  const errors = parsed.success
    ? {}
    : Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0]),
          issue.message,
        ]),
      );
  if (
    !parsed.success &&
    parsed.error.issues.some(
      (issue) =>
        issue.path[0] === "schedules" && issue.code === "invalid_format",
    )
  ) {
    errors.schedules = "Gunakan format jam HH:mm, misalnya 09:00.";
  }
  // Freeze the example at the start of its first day, so today's morning slots can be inspected.
  const now = new Date(brief.startDate + "T00:00:00+07:00");
  const config = {
    ...DEFAULT_CONFIG,
    enabled: false,
    schedules: [...brief.schedules],
    cooldownDays: 7,
  };
  const assignments = parsed.success
    ? selectCampaignAssets(
        assets.filter((asset) => brief.listingIds.includes(asset.id)),
        campaignSchedule(parsed.data, now),
        config.cooldownDays,
        () => new Set(),
        () => false,
        brief.assetOrder,
        undefined,
        brief,
      )
    : [];
  const jobs: (MarketingJob & { publications: [] })[] = assignments.map(
    (slot) => ({
      id: "simulation:" + slot.when.toISOString(),
      scheduledFor: slot.when,
      status: slot.asset ? "queued" : "skipped",
      reason: slot.asset ? null : slot.reason,
      listingId: slot.asset?.id || null,
      assetKey: slot.asset?.assetKey || null,
      snapshot: (slot.asset || {}) as Prisma.JsonValue,
      caption: slot.asset
        ? (source === "archive" ? "PRATINJAU ARSIP · " : "SIMULASI · ") +
          slot.asset.address +
          (source === "archive"
            ? ". Rp " +
              new Intl.NumberFormat("id-ID").format(slot.asset.price) +
              ". Data historis untuk meninjau jadwal; bukan penawaran aktif."
            : ". Foto dan harga contoh untuk mencoba alur Campaign ke Planner.")
        : "",
      media: [],
      settingsRevision: config.revision,
      campaignId: SIMULATION_CAMPAIGN_ID,
      campaignProposalId: PROPOSAL_ID,
      plan: {
        kind: "campaign",
        campaignId: SIMULATION_CAMPAIGN_ID,
        proposalId: PROPOSAL_ID,
        campaignName: brief.name,
        listingId: slot.asset?.id || null,
        channels: brief.channels,
        criteria: campaignCriteria(brief),
      } as Prisma.JsonValue,
      createdAt: now,
      updatedAt: now,
      publications: [],
    }),
  );
  return { assets, assignments, jobs, config, now, errors };
}
