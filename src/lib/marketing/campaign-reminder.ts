import { storedCampaignBriefSchema } from "./campaign";
import { jakartaDate } from "./domain";
import type { CampaignReminderEmail } from "./campaign-reminder-email";

export const CAMPAIGN_REMINDER_HOUR = 8;
export function campaignReminderDay(now: Date): string | null {
  const today = jakartaDate(now);
  if (now < new Date(`${today}T08:00:00+07:00`)) return null;
  return jakartaDate(new Date(now.getTime() + 86400000));
}
/** Only the approved brief controls timing and content, never an unapproved edit. */
export function dueCampaignReminder(
  row: { id: string; state: string; activeBrief: unknown },
  now: Date,
): CampaignReminderEmail | null {
  const tomorrow = campaignReminderDay(now);
  if (!tomorrow || row.state !== "running") return null;
  const brief = storedCampaignBriefSchema.safeParse(row.activeBrief);
  if (!brief.success || brief.data.endDate !== tomorrow) return null;
  return { campaignId: row.id, ...brief.data };
}
