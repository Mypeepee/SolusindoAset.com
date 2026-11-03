const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const createLoader = require("./lib/marketing-test-loader.cjs");
require("dotenv").config({ quiet: true });
const db = new PrismaClient(),
  id = "qa-" + randomUUID();
(async () => {
  try {
    await db.marketingSettings.create({ data: { id } });
    const now = new Date();
    const claim = (token) =>
      db.marketingSettings.updateMany({
        where: {
          id,
          OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }],
        },
        data: {
          leaseToken: token,
          leasedUntil: new Date(now.getTime() + 60000),
        },
      });
    const attempts = await Promise.all([claim("worker-a"), claim("worker-b")]);
    assert.equal(
      attempts.reduce((total, result) => total + result.count, 0),
      1,
    );
    const saves = await Promise.all(
      ["one", "two"].map((name) =>
        db.marketingSettings.updateMany({
          where: { id, revision: 1 },
          data: { config: { name }, revision: { increment: 1 } },
        }),
      ),
    );
    assert.equal(
      saves.reduce((total, result) => total + result.count, 0),
      1,
    );
    const rollback = new Error("QA_ROLLBACK");
    await assert.rejects(
      db.$transaction(async (tx) => {
        const job = await tx.marketingJob.create({
          data: {
            scheduledFor: new Date("2100-01-01T00:00:00Z"),
            settingsRevision: 1,
          },
        });
        const publication = await tx.marketingPublication.create({
          data: { jobId: job.id, channel: "instagram" },
        });
        await tx.marketingMetric.create({
          data: {
            publicationId: publication.id,
            values: { views: 0, likes: null },
          },
        });
        const metric = await tx.marketingMetric.findFirst({
          where: { publicationId: publication.id },
        });
        assert.equal(metric.values.views, 0);
        assert.equal(metric.values.likes, null);
        const assetKey = "qa:" + job.id;
        await tx.marketingJob.update({
          where: { id: job.id },
          data: {
            assetKey,
            scheduledFor: new Date(now.getTime() - 7 * 86400000 - 1800000),
            status: "completed",
          },
        });
        await tx.marketingPublication.update({
          where: { id: publication.id },
          data: {
            state: "published",
            publishedAt: new Date(now.getTime() - 7 * 86400000 + 1800000),
          },
        });
        const store = createLoader({
          "@/lib/prisma": { default: tx, __esModule: true },
          "@/lib/chatbot/server-access": {
            resolveChatbotOwner: async () => ({ status: 200 }),
          },
        })("src/lib/marketing/store.server.ts");
        assert.equal((await store.recentAssetKeys(7, now)).has(assetKey), true);
        await tx.marketingPublication.update({
          where: { id: publication.id },
          data: { publishedAt: new Date(now.getTime() - 8 * 86400000) },
        });
        assert.equal(
          (await store.recentAssetKeys(7, now)).has(assetKey),
          false,
        );
        await tx.marketingPublication.update({
          where: { id: publication.id },
          data: { state: "pending" },
        });
        await tx.marketingJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            listingId: "qa-listing",
            scheduledFor: new Date(now.getTime() + 30 * 86400000),
          },
        });
        assert.equal(
          (await store.recentAssetKeys(7, now)).has(assetKey),
          false,
        );
        await tx.marketingJob.update({
          where: { id: job.id },
          data: { scheduledFor: new Date(now.getTime() + 3 * 86400000) },
        });
        assert.equal((await store.recentAssetKeys(7, now)).has(assetKey), true);
        assert.equal(
          (await store.recentAssetKeys(7, now, job.id)).has(assetKey),
          false,
        );
        await tx.marketingJob.update({
          where: { id: job.id },
          data: {
            listingId: null,
            plan: { kind: "manual", listingId: "1", channels: ["instagram"] },
          },
        });
        assert.equal(
          (await store.recentAssetKeys(7, now)).has(assetKey),
          true,
          "A chosen property is reserved before media preparation",
        );
        await tx.marketingJob.create({
          data: {
            assetKey,
            listingId: "qa-second",
            settingsRevision: 1,
            scheduledFor: new Date(now.getTime() + 4 * 86400000),
          },
        });
        assert.equal(
          (await store.recentAssetKeys(7, now, job.id)).has(assetKey),
          true,
        );
        const { DEFAULT_CONFIG } = createLoader()(
          "src/lib/marketing/domain.ts",
        );
        const planner = createLoader()("src/lib/marketing/planner.ts");
        const plans = createLoader({
          "@/lib/prisma": {
            __esModule: true,
            default: {
              marketingJob: tx.marketingJob,
              $transaction: (callback) => callback(tx),
            },
          },
          "@/lib/investor-read.server": {},
          "@/lib/investor-cma-legacy.server": {},
          "./store.server": {
            getSettings: async () => ({ config: DEFAULT_CONFIG }),
            json: (value) => value,
          },
          "./service.server": {
            lease: (callback) => callback(),
            assertWorkerLease: async () => {},
          },
          "@/lib/chatbot/server-access": {
            resolveChatbotOwner: async () => ({ status: 200 }),
          },
        })("src/lib/marketing/plans.server.ts");
        const original = await tx.marketingJob.findUniqueOrThrow({
          where: { id: job.id },
        });
        const customTime = new Date(now.getTime() + 20 * 86400000);
        customTime.setUTCHours(3, 17, 0, 0);
        const input = {
          jobId: original.id,
          expectedUpdatedAt: original.updatedAt.toISOString(),
          sourceScheduledFor: original.scheduledFor.toISOString(),
          scheduledFor: customTime.toISOString(),
          listingId: null,
          channels: ["instagram"],
        };
        const saved = await plans.configurePlan(input);
        assert.deepEqual(saved.plan.channels, ["instagram"]);
        assert.equal(
          saved.scheduledFor.toISOString(),
          customTime.toISOString(),
        );
        assert.equal(saved.status, "queued");
        assert.equal(saved.publications.length, 0);
        const marker = await tx.marketingJob.findUniqueOrThrow({
          where: { scheduledFor: original.scheduledFor },
        });
        assert.equal(marker.reason, "RESCHEDULED");
        assert.equal(marker.plan.replacementId, original.id);
        const projected = planner.plannerSlots(
          DEFAULT_CONFIG,
          [marker, saved],
          customTime.toISOString().slice(0, 7),
          now,
        );
        assert.equal(
          projected.filter((slot) => slot.key === saved.id).length,
          1,
        );
        await assert.rejects(
          plans.configurePlan({
            ...input,
            sourceScheduledFor: saved.scheduledFor.toISOString(),
            expectedUpdatedAt: new Date(0).toISOString(),
          }),
          (error) => error.code === "PLAN_CONFLICT",
        );
        await tx.marketingPublication.create({
          data: {
            jobId: saved.id,
            channel: "instagram",
            state: "published",
            attemptCount: 1,
          },
        });
        await assert.rejects(
          plans.configurePlan({
            ...input,
            sourceScheduledFor: saved.scheduledFor.toISOString(),
            expectedUpdatedAt: saved.updatedAt.toISOString(),
          }),
          (error) => error.code === "PLANNING_SLOT_LOCKED",
        );
        throw rollback;
      }),
      (error) => error.message === rollback.message,
    );
    console.log(
      JSON.stringify({
        passed: true,
        atomicLease: true,
        revisionConflict: true,
        nullMetrics: true,
        cooldownFromActualPublication: true,
        datedReservationsAndOwnJobExclusion: true,
        manualPlanPersistenceAndRescheduling: true,
        staleAndAttemptedPlansLocked: true,
        queueFixtureRolledBack: true,
      }),
    );
  } finally {
    await db.marketingSettings.deleteMany({ where: { id } });
    await db.$disconnect();
  }
})().catch((error) => {
  console.error("Marketing DB verification:", error.code || error.name);
  process.exitCode = 1;
});
