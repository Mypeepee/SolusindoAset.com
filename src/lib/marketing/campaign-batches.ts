import { jakartaDate } from "./domain";
import { campaignSchedule, type CampaignBrief } from "./campaign";

const DAY = 86400000;
export const CAMPAIGN_BATCH_DAYS = 2;
const at = (day: string) => Date.parse(day + "T00:00:00+07:00");
export const campaignDayAfter = (day: string, offset: number) =>
  jakartaDate(new Date(at(day) + offset * DAY));

/** Two-day batches, prepared on the last day of the preceding batch (WIB). */
export function campaignBatch(
  brief: Pick<CampaignBrief, "startDate" | "endDate">,
  now = new Date(),
) {
  const today = jakartaDate(now);
  if (today > brief.endDate) return null;
  const elapsed = Math.max(
    0,
    Math.floor((at(today) - at(brief.startDate)) / DAY),
  );
  const index = Math.floor((elapsed + 1) / CAMPAIGN_BATCH_DAYS);
  const lastIndex = Math.floor(
    (at(brief.endDate) - at(brief.startDate)) / DAY / CAMPAIGN_BATCH_DAYS,
  );
  const startDate = campaignDayAfter(
    brief.startDate,
    Math.min(index, lastIndex) * CAMPAIGN_BATCH_DAYS,
  );
  const endDate = [campaignDayAfter(startDate, 1), brief.endDate].sort()[0];
  const following = campaignDayAfter(startDate, CAMPAIGN_BATCH_DAYS);
  return {
    startDate,
    endDate,
    nextRefreshAt:
      following <= brief.endDate
        ? new Date(
            campaignDayAfter(following, -1) + "T00:00:00+07:00",
          ).toISOString()
        : null,
  };
}
export type CampaignBatch = NonNullable<ReturnType<typeof campaignBatch>>;

/** Include today's committed batch on late creation, never execute elapsed times. */
export function campaignPreparationDates(
  brief: Pick<CampaignBrief, "startDate" | "endDate" | "schedules">,
  now = new Date(),
) {
  const batch = campaignBatch(brief, now);
  return batch
    ? campaignSchedule(brief, now).filter(
        (date) => jakartaDate(date) <= batch.endDate,
      )
    : [];
}

export type CampaignQueueState = CampaignBatch & {
  checkedAt: string;
  policyVersion: number;
  retryAt: string | null;
};
export function campaignQueueState(raw: unknown): CampaignQueueState | null {
  const queue = (raw as { queue?: CampaignQueueState } | null)?.queue;
  return queue &&
    typeof queue.startDate === "string" &&
    typeof queue.endDate === "string" &&
    Number.isFinite(Date.parse(queue.checkedAt))
    ? queue
    : null;
}
