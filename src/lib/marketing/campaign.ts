import { z } from "zod";
import type { CampaignInventoryDiagnostics } from "./campaign-inventory";
import { campaignTimeOrderIssue } from "./campaign-time-input";
import type { CampaignBatch } from "./campaign-batches";
import {
  captionFor,
  DEFAULT_CONFIG,
  jakartaDate,
  settingsSchema,
  scheduledSlots,
  type AssetSnapshot,
  type Channel,
  type MarketingConfig,
  type MarketingSelectionConfig,
} from "./domain";

const day = z
  .string()
  .regex(/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)
  .refine((v) => {
    const date = new Date(v + "T12:00:00+07:00");
    return Number.isFinite(date.getTime()) && jakartaDate(date) === v;
  }, "Tanggal tidak valid.");
const discountPercent = z
  .number({ message: "Isi persentase antara 0 dan 100." })
  .finite("Isi persentase antara 0 dan 100.")
  .min(0, "Persentase minimal 0%.")
  .max(100, "Persentase maksimal 100%.");
export const campaignCriteriaSchema = z
  .object({
    city: settingsSchema.shape.city,
    locations: settingsSchema.shape.locations,
    category: settingsSchema.shape.category,
    propertyTypes: settingsSchema.shape.propertyTypes,
    minPrice: settingsSchema.shape.minPrice,
    maxPrice: settingsSchema.shape.maxPrice,
    // Optional for existing campaign briefs and approved Planner jobs.
    minSpread: discountPercent.optional(),
    minDrop: discountPercent.optional(),
    discountMode: z.enum(["either", "market", "auction"]).optional(),
  })
  .strict();
const listingId = z.string().regex(/^[1-9]\d{0,19}$/);
const selectedIds = z
  .array(listingId)
  .max(90 * 12)
  .refine(
    (v) => new Set(v).size === v.length,
    "Pilihan aset tidak boleh berulang.",
  );
/** Historical approved records remain readable with their original stored time order. */
export const storedCampaignBriefSchema = campaignCriteriaSchema
  .extend({
    name: z
      .string()
      .trim()
      .min(3, "Isi nama campaign, minimal 3 karakter.")
      .max(120),
    startDate: day,
    endDate: day,
    schedules: settingsSchema.shape.schedules.refine(
      (v) => new Set(v).size === v.length,
      "Jam tayang tidak boleh berulang.",
    ),
    listingIds: selectedIds,
    assetOrder: z.enum(["fresh", "manual"]).default("fresh"),
    channels: z
      .array(z.enum(["instagram", "whatsapp"]))
      .min(1, "Pilih minimal satu kanal.")
      .max(2)
      .refine((v) => new Set(v).size === v.length),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai.",
      });
    if (Date.parse(v.endDate) - Date.parse(v.startDate) > 89 * 86400000)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Periode campaign maksimal 90 hari.",
      });
    if (v.minPrice !== null && v.maxPrice !== null && v.minPrice > v.maxPrice)
      ctx.addIssue({
        code: "custom",
        path: ["maxPrice"],
        message: "Harga maksimum harus sama atau lebih besar dari minimum.",
      });
  });
/** Every new save, proposal and approval requires an increasing daily rhythm. */
export const campaignBriefSchema = storedCampaignBriefSchema.superRefine(
  (brief, ctx) => {
    const issue = campaignTimeOrderIssue(brief.schedules);
    if (issue)
      ctx.addIssue({
        code: "custom",
        path: ["schedules", issue.index],
        message: issue.message,
      });
  },
);
export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
export const campaignInventorySchema = z
  .object({
    criteria: campaignCriteriaSchema,
    startDate: day,
    endDate: day,
    listingIds: selectedIds,
    campaignId: z.string().uuid().optional(),
    schedules: settingsSchema.shape.schedules.default(DEFAULT_CONFIG.schedules),
    query: z.string().max(100).default(""),
    offset: z.number().int().min(0).max(100000).default(0),
  })
  .strict()
  .refine(
    (v) =>
      v.endDate >= v.startDate &&
      Date.parse(v.endDate) - Date.parse(v.startDate) <= 89 * 86400000,
    "Periksa rentang tanggal campaign.",
  )
  .refine(
    (v) =>
      v.criteria.minPrice === null ||
      v.criteria.maxPrice === null ||
      v.criteria.minPrice <= v.criteria.maxPrice,
    "Periksa rentang harga aset.",
  );
export type CampaignInventoryInput = z.infer<typeof campaignInventorySchema>;
export type CampaignArchive = {
  asOf: string;
  latestAuctionDate: string;
  assets: AssetSnapshot[];
};
export type CampaignArchiveScenario = {
  campaignId: string;
  brief: CampaignBrief;
  archive: CampaignArchive;
};
export type CampaignInventory = {
  items: AssetSnapshot[];
  total: number;
  nextOffset: number;
  selected: { id: string; asset: AssetSnapshot | null }[];
  diagnostics?: CampaignInventoryDiagnostics;
  archive?: CampaignArchive;
  recommendation?: {
    assets: AssetSnapshot[];
    filled: number;
    target: number;
    expiring: number;
    coverage?: { eligible: number; scheduled: number; remaining: number };
    checkedAt: string;
  };
};
export type CampaignSlot = {
  id: string;
  scheduledFor: string;
  asset: AssetSnapshot;
  reason: string;
};
export type CampaignGap = { id: string; scheduledFor: string; reason: string };
export type CampaignProposal = {
  batch?: CampaignBatch;
  policyVersion?: number;
  coverage?: { eligible: number; scheduled: number; remaining: number };
  slots: CampaignSlot[];
  unfilled: CampaignGap[];
  stock: number;
  capacity: number;
  target: number;
  settingsRevision: number;
  generatedAt: string;
  briefKey: string;
};
export type CampaignRecord = {
  id: string;
  revision: number;
  state: string;
  brief: CampaignBrief;
  activeBrief?: CampaignBrief | null;
  createdAt: string;
  updatedAt: string;
  planned: number;
  published: number;
};
export type CampaignProposalRecord = {
  id: string;
  version: number;
  approvedAt: string | null;
  data: CampaignProposal;
};
export type CampaignJobSummary = {
  id: string;
  scheduledFor: string;
  status: string;
  reason: string | null;
  address: string;
  publications: {
    id: string;
    channel: string;
    state: string;
    errorCode: string | null;
    metrics: Record<string, number | null> | null;
  }[];
};
export type CampaignDetail = {
  campaign: CampaignRecord;
  proposal: CampaignProposalRecord | null;
  jobs: CampaignJobSummary[];
  jobsTotal: number;
};
export type CampaignPeriod = {
  startDate: string;
  endDate: string;
  plan?: {
    id: string;
    name: string;
    schedules: string[];
    channels: Channel[];
    state: "draft" | "running" | "paused";
    preparedThrough?: string;
    /** Company-wide creation order keeps visual identity independent of month/filter. */
    appearanceIndex?: number;
  };
};
export const campaignPlanSchema = z.object({
  kind: z.literal("campaign"),
  campaignId: z.string().uuid(),
  proposalId: z.string().uuid(),
  campaignName: z.string(),
  selectionReason: z.string().optional(),
  listingId: listingId.nullable(),
  channels: campaignBriefSchema.shape.channels,
  criteria: campaignCriteriaSchema,
});
export type CampaignPlan = z.infer<typeof campaignPlanSchema>;
export function campaignPlan(job: { plan?: unknown } | null | undefined) {
  const result = campaignPlanSchema.safeParse(job?.plan);
  return result.success ? result.data : null;
}
/** Read older campaign records without requiring a destructive data migration. */
export function storedCampaignBrief(value: unknown): CampaignBrief {
  const old = value as Record<string, unknown>;
  const keys = [
    ...Object.keys(campaignCriteriaSchema.shape),
    "name",
    "startDate",
    "endDate",
    "channels",
  ];
  const fields = Object.fromEntries(keys.map((k) => [k, old[k]]));
  return storedCampaignBriefSchema.parse({
    ...fields,
    schedules: old.schedules || DEFAULT_CONFIG.schedules,
    listingIds: old.listingIds || [],
    assetOrder:
      old.assetOrder ||
      (Array.isArray(old.listingIds) && old.listingIds.length
        ? "manual"
        : "fresh"),
  });
}
export function campaignCriteria(brief: CampaignBrief) {
  const { city, locations, category, propertyTypes, minPrice, maxPrice } =
    brief;
  return {
    city,
    locations,
    category,
    propertyTypes,
    minPrice,
    maxPrice,
    ...(brief.minSpread !== undefined ? { minSpread: brief.minSpread } : {}),
    ...(brief.minDrop !== undefined ? { minDrop: brief.minDrop } : {}),
    ...(brief.discountMode !== undefined
      ? { discountMode: brief.discountMode }
      : {}),
  };
}
export function campaignConfig(
  config: MarketingConfig,
  criteria: z.infer<typeof campaignCriteriaSchema>,
): MarketingSelectionConfig {
  return {
    ...config,
    ...criteria,
    minSpread: criteria.minSpread ?? config.minSpread,
    minDrop: criteria.minDrop ?? config.minDrop,
    discountMode: criteria.discountMode ?? "either",
  };
}
export function campaignStatus(
  campaign: Pick<CampaignRecord, "state" | "brief" | "activeBrief">,
  now = new Date(),
) {
  const brief = campaignAppliedBrief(campaign);
  const today = jakartaDate(now);
  if (campaignPeriodEnded(brief, now)) return "Berakhir";
  if (campaign.state === "draft") return "Draf";
  if (campaign.state === "paused") return "Dijeda";
  return today < brief.startDate ? "Terjadwal" : "Aktif";
}
export function campaignAppliedBrief(
  campaign: Pick<CampaignRecord, "state" | "brief" | "activeBrief">,
) {
  return campaign.state !== "draft" && campaign.activeBrief
    ? campaign.activeBrief
    : campaign.brief;
}
export function campaignPeriodEnded(
  brief: Pick<CampaignBrief, "endDate">,
  now = new Date(),
) {
  return jakartaDate(now) > brief.endDate;
}
/** Dispatch uses the approved period, never an unapplied edit of the campaign. */
export function campaignExecutionIssue(
  row: { state: string; brief: unknown; activeBrief?: unknown } | null,
  scheduledFor: Date,
  now = new Date(),
  dispatch = false,
) {
  if (!row) return "CAMPAIGN_PAUSED";
  const parsed = storedCampaignBriefSchema.safeParse(
    row.activeBrief ?? row.brief,
  );
  if (!parsed.success) return "CAMPAIGN_REVIEW_REQUIRED";
  const period = parsed.data;
  if (campaignPeriodEnded(period, now)) return "CAMPAIGN_ENDED";
  const day = jakartaDate(scheduledFor);
  if (
    day < period.startDate ||
    day > period.endDate ||
    (dispatch && jakartaDate(now) < period.startDate)
  )
    return "CAMPAIGN_OUTSIDE_PERIOD";
  return row.state === "running" ? null : "CAMPAIGN_PAUSED";
}
export function campaignCaption(asset: AssetSnapshot, config: MarketingConfig) {
  return captionFor(asset, config);
}
export function campaignSchedule(
  brief: Pick<CampaignBrief, "startDate" | "endDate" | "schedules">,
  now = new Date(),
) {
  const result: Date[] = [];
  for (
    let date = new Date(brief.startDate + "T12:00:00+07:00");
    jakartaDate(date) <= brief.endDate;
    date = new Date(date.getTime() + 86400000)
  ) {
    for (const slot of scheduledSlots(
      { ...DEFAULT_CONFIG, schedules: brief.schedules },
      date,
    ))
      if (slot > now && slot.getTime() <= now.getTime() + 90 * 86400000)
        result.push(slot);
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}
export function campaignCoversDay(periods: CampaignPeriod[], date: string) {
  return periods.some((p) => p.startDate <= date && p.endDate >= date);
}
export function sameCampaignAsset(a: AssetSnapshot, b: AssetSnapshot) {
  const facts = (v: AssetSnapshot) =>
    JSON.stringify([
      v.id,
      v.assetKey,
      v.title,
      v.address,
      v.city,
      v.price,
      v.landArea,
      v.certificateType || null,
      v.category,
      v.propertyType,
      v.auctionDate,
      v.listingUrl,
      v.agentName || null,
      v.agentPhone || null,
      v.slug || null,
      v.sourceCityName || null,
      v.agentId || null,
      v.sourcePrice ?? null,
      v.sourcePromoPrice ?? null,
      v.sourceLimitPrice ?? null,
      v.auctionDeposit ?? null,
      v.buildingAreaSqm ?? null,
      v.bedroomCount ?? null,
      v.bathroomCount ?? null,
      v.floorCount ?? null,
      v.auctionHistoryPoints || [],
      v.images,
      v.revision,
    ]);
  return facts(a) === facts(b);
}
export const campaignErrors: Record<string, string> = {
  CAMPAIGN_POLICY_CHANGED:
    "Aturan penjadwalan berubah. Susun ulang jadwal dengan batas H−5 sebelum diterapkan.",
  CAMPAIGN_ENDED:
    "Periode campaign sudah berakhir. Ubah periode sebelum menyusun jadwal baru.",
  CAMPAIGN_OUTSIDE_PERIOD:
    "Waktu tayang berada di luar periode campaign yang diterapkan.",
  UNAUTHENTICATED:
    "Sesi berakhir. Masuk kembali untuk melanjutkan; isian Anda tetap ada.",
  FORBIDDEN: "Campaign hanya tersedia untuk owner aktif.",
  WORKER_BUSY: "Sistem sedang memproses pemasaran. Coba kembali sebentar lagi.",
  INVALID_SETTINGS:
    "Periksa isian campaign yang belum lengkap atau tidak valid.",
  CAMPAIGN_CONFLICT:
    "Campaign atau jadwalnya telah berubah. Muat ulang sebelum melanjutkan.",
  CAMPAIGN_SLOT_CONFLICT:
    "Jam ini sudah digunakan rencana lain. Ubah jam campaign atau susun ulang jadwal.",
  CAMPAIGN_REVIEW_REQUIRED:
    "Aset atau kelayakannya berubah. Periksa pilihan aset dan susun ulang jadwal.",
  CAMPAIGN_PAUSED: "Campaign dijeda. Jadwal tetap disimpan.",
  CAMPAIGN_REPLACED: "Jadwal digantikan oleh revisi campaign.",
  CAMPAIGN_NO_SLOTS: "Belum ada jadwal yang terisi aset dan dapat diterapkan.",
  CAMPAIGN_SELECT_ASSETS: "Pilih minimal satu aset untuk campaign ini.",
  CAMPAIGN_NO_ELIGIBLE_ASSET:
    "Tidak ada aset pilihan yang tersedia pada jam ini setelah memperhitungkan kelayakan dan jeda pengulangan.",
  CAMPAIGN_SCHEDULE:
    "Jadwal otomatis reguler digantikan oleh jadwal campaign pada periode ini.",
  CAMPAIGN_INVALID_PERIOD: "Pilih periode mendatang hingga 90 hari ke depan.",
  CAMPAIGN_LOCKED: "Jadwal ini dikelola dari menu Campaign.",
  CAMPAIGN_NOT_FOUND: "Campaign tidak ditemukan.",
  CHANNEL_DISABLED: "Kanal campaign sedang nonaktif di Pengaturan.",
  INVALID_PLANNING_SLOT:
    "Pilih tanggal dalam periode dan salah satu jam tayang campaign.",
  SCHEMA_NOT_READY:
    "Campaign belum siap di server. Hubungi pengelola aplikasi.",
};
