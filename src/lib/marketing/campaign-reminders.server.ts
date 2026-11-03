import "server-only";
import prisma from "@/lib/prisma";
import { isMailConfigured, sendCampaignReminderEmail } from "@/lib/mailer";
import { CAMPAIGN_REMINDER_RECIPIENTS } from "./campaign-reminder-email";
import { campaignReminderDay, dueCampaignReminder } from "./campaign-reminder";

/** Runs under the worker lease, independently of the social publishing switch. */
export async function runCampaignReminders(
  now = new Date(),
  assertLease: () => Promise<void> = async () => {},
) {
  const result = {
    sent: 0,
    retry: 0,
    uncertain: 0,
    configured: isMailConfigured(),
  };
  const endDate = campaignReminderDay(now);
  if (!result.configured || !endDate) return result;
  // SMTP may have accepted mail before a process stopped. Never blindly resend.
  await prisma.marketingCampaignReminder.updateMany({
    where: {
      state: "sending",
      updatedAt: { lt: new Date(now.getTime() - 5 * 60000) },
    },
    data: { state: "uncertain", errorCode: "DELIVERY_UNCERTAIN" },
  });
  const campaigns = await prisma.marketingCampaign.findMany({
    where: {
      state: "running",
      activeBrief: { path: ["endDate"], equals: endDate },
    },
    select: { id: true, state: true, activeBrief: true },
  });
  for (const campaign of campaigns) {
    const email = dueCampaignReminder(campaign, now);
    if (!email) continue;
    for (const recipient of CAMPAIGN_REMINDER_RECIPIENTS) {
      await assertLease();
      const reminder = await prisma.marketingCampaignReminder.upsert({
        where: {
          campaignId_endDate_recipient: {
            campaignId: campaign.id,
            endDate,
            recipient,
          },
        },
        create: { campaignId: campaign.id, endDate, recipient },
        update: {},
      });
      const claimed = await prisma.marketingCampaignReminder.updateMany({
        where: {
          id: reminder.id,
          state: { in: ["pending", "retry"] },
          attempts: { lt: 5 },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        data: { state: "sending", attempts: { increment: 1 }, errorCode: null },
      });
      if (!claimed.count) continue;
      const delivery = await sendCampaignReminderEmail(
        recipient,
        email,
        reminder.id,
      );
      const state =
        delivery.state === "unconfigured" ? "retry" : delivery.state;
      await prisma.marketingCampaignReminder.update({
        where: { id: reminder.id },
        data: {
          state,
          messageId: delivery.messageId,
          errorCode: delivery.errorCode || null,
          sentAt: state === "sent" ? new Date() : null,
          nextAttemptAt:
            state === "retry" ? new Date(now.getTime() + 15 * 60000) : null,
        },
      });
      result[state]++;
    }
  }
  return result;
}
