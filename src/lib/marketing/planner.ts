import {
  jakartaDate,
  scheduledSlots,
  PLANNING_DAYS,
  type Channel,
  type MarketingConfig,
  type AssetSnapshot,
} from "./domain";
import { campaignAssetAvailable } from "./campaign-selection";
import { manualPlan } from "./plan";
import { campaignPlan, type CampaignPeriod } from "./campaign";

export { PLANNING_DAYS } from "./domain";
export function monthBounds(month: string) {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month))
    throw new RangeError("INVALID_MONTH");
  const start = new Date(month + "-01T00:00:00+07:00");
  const [year, number] = month.split("-").map(Number);
  const next =
    number === 12
      ? `${year + 1}-01`
      : `${year}-${String(number + 1).padStart(2, "0")}`;
  return { start, end: new Date(next + "-01T00:00:00+07:00") };
}
export function shiftMonth(month: string, delta: number) {
  const { start } = monthBounds(month);
  const date = new Date(start.getTime() + 7 * 3600000);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function monthDays(month: string) {
  const { start, end } = monthBounds(month);
  const dates: string[] = [];
  for (let time = start.getTime(); time < end.getTime(); time += 86400000)
    dates.push(jakartaDate(new Date(time)));
  return dates;
}
export function calendarDays(month: string) {
  const dates = monthDays(month);
  const weekday = new Date(dates[0] + "T12:00:00+07:00").getUTCDay();
  const offset = (weekday + 6) % 7;
  const cells: (string | null)[] = [...Array(offset).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  return cells;
}
/** Calendar coverage follows the saved period, independently of slot/channel filters. */
export function plannerCampaignsOnDay(periods: CampaignPeriod[], day: string) {
  return periods.flatMap((period) =>
    period.plan && period.startDate <= day && day <= period.endDate
      ? [{ ...period, plan: period.plan }]
      : [],
  ).sort((a, b) =>
    Number(a.plan.state === "draft") - Number(b.plan.state === "draft") ||
    a.startDate.localeCompare(b.startDate) || a.plan.id.localeCompare(b.plan.id),
  );
}
export function canPrepareSlot(
  config: MarketingConfig,
  date: Date,
  now = new Date(),
) {
  return (
    Number.isFinite(date.getTime()) &&
    date > now &&
    date.getTime() <= now.getTime() + PLANNING_DAYS * 86400000 &&
    scheduledSlots(config, date).some(
      (slot) => slot.getTime() === date.getTime(),
    )
  );
}
export type ScheduledJob = {
  id: string;
  scheduledFor: Date | string;
  status: string;
  listingId: string | null;
  plan?: unknown;
  reason?: string | null;
  snapshot?: unknown;
  publications: { channel: string; state: string; attemptCount?: number }[];
};
export type PlannerSlot<T extends ScheduledJob> = {
  key: string;
  date: string;
  scheduledFor: string;
  channels: Channel[];
  job: T | null;
  campaign?: NonNullable<CampaignPeriod["plan"]>;
};
export function plannerSlots<T extends ScheduledJob>(
  config: MarketingConfig,
  jobs: T[],
  month: string,
  now = new Date(),
  campaignPeriods: CampaignPeriod[] = [],
): PlannerSlot<T>[] {
  const result = new Map<string, PlannerSlot<T>>();
  const channels = (["instagram", "whatsapp"] as Channel[]).filter(
    (channel) => config[channel],
  );
  for (const day of monthDays(month)) {
    const covering = campaignPeriods.filter(
      (period) => period.startDate <= day && period.endDate >= day,
    );
    if (covering.length) {
      // Approved rhythms own their days. An unapplied edit cannot replace them.
      const approved = covering.filter(
        (period) => period.plan?.state !== "draft",
      );
      for (const period of approved.length ? approved : covering) {
        if (!period.plan) continue;
        for (const time of period.plan.schedules) {
          const scheduledFor = new Date(
            `${day}T${time}:00+07:00`,
          ).toISOString();
          if (!result.has(scheduledFor))
            result.set(scheduledFor, {
              key: `${period.plan.id}:${scheduledFor}`,
              date: day,
              scheduledFor,
              channels: period.plan.channels,
              campaign: period.plan,
              job: null,
            });
        }
      }
      continue;
    }
    for (const date of scheduledSlots(
      config,
      new Date(day + "T12:00:00+07:00"),
    )) {
      // A projected slot is a future plan, never invented publication history.
      if (date <= now) continue;
      const scheduledFor = date.toISOString();
      result.set(scheduledFor, {
        key: scheduledFor,
        date: day,
        scheduledFor,
        channels,
        job: null,
      });
    }
  }
  for (const job of jobs) {
    if (job.reason === "CAMPAIGN_REPLACED") continue;
    const scheduledFor = new Date(job.scheduledFor).toISOString();
    const day = jakartaDate(new Date(scheduledFor));
    if (!day.startsWith(month + "-")) continue;
    // Regular empty projections must not add default hours inside a campaign.
    // Retain every assignment, manual plan, and delivery attempt as evidence.
    const covered = campaignPeriods.some(
      (period) => period.startDate <= day && period.endDate >= day,
    );
    const untouched =
      !campaignPlan(job) &&
      !manualPlan(job) &&
      !job.listingId &&
      !(job.snapshot as AssetSnapshot | undefined)?.id &&
      ["queued", "paused", "skipped"].includes(job.status) &&
      !job.publications.some(
        (item) =>
          (item.attemptCount || 0) > 0 ||
          ["published", "sending", "uncertain", "failed"].includes(item.state),
      );
    if (covered && untouched) continue;
    if (job.reason === "RESCHEDULED" || job.reason === "CAMPAIGN_SCHEDULE") {
      if (!result.get(scheduledFor)?.campaign) result.delete(scheduledFor);
      continue;
    }
    const knownChannels = job.publications
      .map((item) => item.channel)
      .filter(
        (channel): channel is Channel =>
          channel === "instagram" || channel === "whatsapp",
      );
    result.set(scheduledFor, {
      key: job.id,
      date: day,
      scheduledFor,
      channels: knownChannels.length
        ? knownChannels
        : campaignPlan(job)?.channels || manualPlan(job)?.channels || channels,
      job,
    });
  }
  return [...result.values()].sort((a, b) =>
    a.scheduledFor.localeCompare(b.scheduledFor),
  );
}
export function plannerSlotState(
  slot: PlannerSlot<ScheduledJob>,
  now = new Date(),
) {
  if (slot.job || !slot.campaign) return slotState(slot.job, now);
  if (new Date(slot.scheduledFor) <= now) return "elapsed";
  if (
    slot.campaign.preparedThrough &&
    slot.date > slot.campaign.preparedThrough
  )
    return "awaiting";
  return slot.campaign.state === "draft" ? "draft" : "unfilled";
}
export function slotState(job: ScheduledJob | null, now = new Date()) {
  if (!job) return "automatic";
  if (
    job.status === "skipped" &&
    job.reason === "CAMPAIGN_NO_ELIGIBLE_ASSET" &&
    campaignPlan(job) &&
    new Date(job.scheduledFor) > now
  )
    return "unfilled";
  if (
    ["queued", "paused"].includes(job.status) &&
    new Date(job.scheduledFor).getTime() < now.getTime() - 3600000 &&
    !job.publications.some((p) =>
      ["published", "sending", "uncertain"].includes(p.state),
    )
  )
    return "missed";
  if (["queued", "paused"].includes(job.status) && campaignPlan(job)) {
    const asset = job.snapshot as AssetSnapshot | undefined;
    if (
      asset?.id &&
      !campaignAssetAvailable(
        asset,
        new Date(Math.max(now.getTime(), new Date(job.scheduledFor).getTime())),
      )
    )
      return "review";
  }
  if (job.status === "queued")
    return job.listingId
      ? "ready"
      : manualPlan(job) || campaignPlan(job)
        ? "planned"
        : "automatic";
  return job.status;
}
export const plannerStateLabels: Record<string, string> = {
  awaiting: "Menunggu batch",
  draft: "Jadwal draf",
  elapsed: "Waktu lewat",
  unfilled: "Belum terisi",
  missed: "Terlewat",
  automatic: "Slot otomatis",
  ready: "Materi siap",
  planned: "Rencana tersimpan",
  completed: "Terbit",
  partial: "Sebagian terbit",
  review: "Perlu diperiksa",
  skipped: "Dilewati",
  publishing: "Menerbitkan",
  preparing: "Menyiapkan",
  paused: "Dijeda",
};
