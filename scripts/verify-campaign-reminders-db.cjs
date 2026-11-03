// Real PostgreSQL uniqueness/claims, mocked SMTP, rollback-only test fixtures.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const createLoader = require("./lib/marketing-test-loader.cjs");
require("dotenv").config({ quiet: true });
require("dotenv").config({ path: ".env.local", override: true, quiet: true });
const db = new PrismaClient();
const rollback = new Error("ROLLBACK_TEST_FIXTURES");
const now = new Date("2026-11-01T01:00:00Z");
async function main() {
  try {
    await db.$transaction(
      async (tx) => {
        const campaignId = randomUUID(),
          deliveries = [];
        const brief = {
          name: "Fixture pengingat campaign",
          startDate: "2026-10-28",
          endDate: "2026-11-02",
          city: "Surabaya",
          locations: [],
          category: "ALL",
          propertyTypes: [],
          minPrice: null,
          maxPrice: null,
          schedules: ["09:00", "13:00"],
          listingIds: [],
          channels: ["instagram"],
          assetOrder: "fresh",
        };
        await tx.marketingCampaign.create({
          data: { id: campaignId, brief, activeBrief: brief, state: "running" },
        });
        const run = createLoader({
          "@/lib/prisma": {
            marketingCampaign: {
              findMany: (args) =>
                tx.marketingCampaign.findMany({
                  ...args,
                  where: { ...args.where, id: campaignId },
                }),
            },
            marketingCampaignReminder: {
              ...tx.marketingCampaignReminder,
              // Never update reminders belonging to real campaigns during verification.
              updateMany: (args) =>
                tx.marketingCampaignReminder.updateMany({
                  ...args,
                  where: { ...args.where, campaignId },
                }),
            },
          },
          "@/lib/mailer": {
            isMailConfigured: () => true,
            sendCampaignReminderEmail: async (to) => {
              deliveries.push(to);
              return { state: "sent", messageId: "fixture" };
            },
          },
        })(
          "src/lib/marketing/campaign-reminders.server.ts",
        ).runCampaignReminders;
        assert.equal((await run(now)).sent, 2);
        assert.equal((await run(now)).sent, 0);
        assert.equal(
          await tx.marketingCampaignReminder.count({
            where: { campaignId, state: "sent" },
          }),
          2,
        );
        await tx.marketingCampaign.update({
          where: { id: campaignId },
          data: { brief: { ...brief, endDate: "2026-12-01" } },
        });
        assert.equal(
          (await run(now)).sent,
          0,
          "unapproved edits do not re-send",
        );
        await tx.marketingCampaign.update({
          where: { id: campaignId },
          data: { activeBrief: { ...brief, endDate: "2026-11-03" } },
        });
        assert.equal((await run(new Date("2026-11-02T01:00:00Z"))).sent, 2);
        assert.equal(deliveries.length, 4);
        assert.equal(
          await tx.marketingCampaignReminder.count({ where: { campaignId } }),
          4,
        );
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    JSON.stringify({
      database: "passed",
      fixtures: "rolled back",
      smtpDispatches: 0,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
