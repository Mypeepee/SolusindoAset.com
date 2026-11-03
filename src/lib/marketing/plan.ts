import { z } from "zod";
import { campaignPlan } from "./campaign";
import {
  jakartaDate,
  PLANNING_DAYS,
  eligibleAsset,
  assetIdentity,
  type AssetSnapshot,
  type Channel,
  type MarketingConfig,
} from "./domain";
import {
  hasVerifiedKelurahan,
  type InvestorListing,
} from "@/lib/investor-deals";

export const planCandidateReasonLabels = {
  LISTING_INACTIVE: "Listing sudah tidak aktif.",
  INVALID_PRICE: "Harga properti belum valid.",
  AUCTION_DATE_REQUIRED: "Jadwal lelang belum tersedia.",
  AUCTION_EXPIRED: "Jadwal lelang sudah lewat.",
  AUCTION_BEFORE_PUBLICATION: "Lelang berlangsung sebelum jadwal konten ini.",
  UNVERIFIED_LOCATION: "Data kelurahan belum terverifikasi.",
  NOT_WORTH_IT: "Belum memenuhi kriteria Worth-it pemasaran.",
  ASSET_COOLDOWN: "Sudah dijadwalkan atau masih dalam jeda pemasaran.",
  ASSET_ALREADY_MARKETED:
    "Properti sudah pernah tayang atau pengirimannya masih diperiksa.",
  PHOTO_UNAVAILABLE: "Foto properti belum tersedia.",
};
export type PlanCandidateReason = keyof typeof planCandidateReasonLabels;
export type PlanCandidate = AssetSnapshot & {
  unavailableReason: PlanCandidateReason | null;
};
export function planCandidateReason(
  item: InvestorListing,
  config: MarketingConfig,
  when: Date,
  reserved: ReadonlySet<string>,
  now = new Date(),
): PlanCandidateReason | null {
  if (eligibleAsset(item, config, when))
    return reserved.has(assetIdentity(item)) ? "ASSET_COOLDOWN" : null;
  if (item.status !== "TERSEDIA") return "LISTING_INACTIVE";
  if (
    !Number.isFinite(item.currentAuctionPrice) ||
    item.currentAuctionPrice <= 0
  )
    return "INVALID_PRICE";
  if (item.listingCategory === "LELANG") {
    const auction = Date.parse(item.auctionDate || "");
    if (!Number.isFinite(auction)) return "AUCTION_DATE_REQUIRED";
    if (auction <= now.getTime()) return "AUCTION_EXPIRED";
    if (auction <= when.getTime()) return "AUCTION_BEFORE_PUBLICATION";
  }
  if (!hasVerifiedKelurahan(item)) return "UNVERIFIED_LOCATION";
  return "NOT_WORTH_IT";
}

const channels = z
  .array(z.enum(["instagram", "whatsapp"]))
  .min(1)
  .max(2)
  .refine((items) => new Set(items).size === items.length);
const listingId = z
  .string()
  .regex(/^[1-9]\d{0,19}$/)
  .nullable();
export const manualPlanSchema = z.object({
  kind: z.literal("manual"),
  listingId,
  channels,
});
export type ManualPlan = z.infer<typeof manualPlanSchema>;
export const configurePlanSchema = z
  .object({
    jobId: z.string().uuid().optional(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
    sourceScheduledFor: z.string().datetime({ offset: true }),
    scheduledFor: z.string().datetime({ offset: true }),
    listingId,
    channels,
  })
  .superRefine((value, ctx) => {
    if (value.jobId && !value.expectedUpdatedAt)
      ctx.addIssue({
        code: "custom",
        path: ["expectedUpdatedAt"],
        message: "Muat ulang rencana sebelum menyimpan.",
      });
  });
export type ConfigurePlan = z.infer<typeof configurePlanSchema>;
export function manualPlan(job: { plan?: unknown } | null | undefined) {
  const parsed = manualPlanSchema.safeParse(job?.plan);
  return parsed.success ? parsed.data : null;
}
export function planChannels(
  job: { plan?: unknown },
  config: MarketingConfig,
): Channel[] {
  return (
    campaignPlan(job)?.channels ||
    manualPlan(job)?.channels ||
    (["instagram", "whatsapp"] as Channel[]).filter(
      (channel) => config[channel],
    )
  );
}
export function validPlanTime(value: Date, now = new Date()) {
  return (
    Number.isFinite(value.getTime()) &&
    value > now &&
    value.getTime() <= now.getTime() + PLANNING_DAYS * 86400000 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}
export function localPlanTime(day: string, time: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return null;
  const value = new Date(day + "T" + time + ":00+07:00");
  return Number.isFinite(value.getTime()) && jakartaDate(value) === day
    ? value
    : null;
}
export function editablePlan(
  job: {
    plan?: unknown;
    status: string;
    reason?: string | null;
    publications: { attemptCount?: number; state: string }[];
  } | null,
) {
  return (
    !job ||
    (!campaignPlan(job) &&
      ["queued", "skipped"].includes(job.status) &&
      job.reason !== "RESCHEDULED" &&
      !job.publications.some(
        (item) =>
          (item.attemptCount || 0) > 0 ||
          ["published", "sending", "uncertain"].includes(item.state),
      ))
  );
}
