// One-off publication requested by the owner. Does not enable the scheduler or WhatsApp.
const fs = require("node:fs/promises");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config({ quiet: true });
require("dotenv").config({ path: ".env.local", override: true, quiet: true });
const db = new PrismaClient();
const load = require("./lib/marketing-test-loader.cjs")({
  "@/lib/prisma": { __esModule: true, default: db },
});
const service = load("src/lib/marketing/service.server.ts");
const store = load("src/lib/marketing/store.server.ts");
const ig = load("src/lib/marketing/instagram.server.ts");
const media = load("src/lib/marketing/media.server.ts");
const security = load("src/lib/marketing/security.server.ts");
const dedup = load("src/lib/marketing/campaign-dedup.server.ts");
async function prepare() {
  return service.lease(async () => {
    const { config } = await store.getSettings();
    if (config.enabled) throw new Error("TRIAL_REQUIRES_PAUSED_AUTOMATION");
    let job = await db.marketingJob.findFirst({
      where: {
        status: "preparing",
        plan: { path: ["instagramTrial"], equals: true },
        publications: { none: { attemptCount: { gt: 0 } } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!job)
      job = await db.marketingJob.create({
        data: {
          status: "preparing",
          scheduledFor: new Date(),
          settingsRevision: config.revision,
          plan: {
            kind: "manual",
            listingId: null,
            channels: ["instagram"],
            instagramTrial: true,
          },
        },
      });
    if (!job.listingId) {
      try {
        job = await service.prepareMarketingJob(job, config);
      } catch (error) {
        await db.marketingJob.update({
          where: { id: job.id },
          data: {
            status: "review",
            reason: error.code || "PREPARATION_FAILED",
          },
        });
        throw error;
      }
    }
    const record = {
      jobId: job.id,
      asset: job.snapshot,
      caption: job.caption,
      media: job.media,
    };
    await fs.writeFile(
      path.join("uploads", "marketing", job.id, "trial.json"),
      JSON.stringify(record, null, 2) + "\n",
      { mode: 0o600 },
    );
    console.log(JSON.stringify({ prepared: true, ...record }));
  });
}
async function publish(jobId) {
  if (!/^[a-f0-9-]{36}$/.test(jobId || "")) throw new Error("INVALID_JOB");
  return service.lease(async () => {
    const { config } = await store.getSettings();
    if (config.enabled) throw new Error("TRIAL_REQUIRES_PAUSED_AUTOMATION");
    const job = await db.marketingJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    if (!job.plan?.instagramTrial || !job.listingId || !job.caption)
      throw new Error("NOT_A_PREPARED_TRIAL");
    let publication = await db.marketingPublication.upsert({
      where: { jobId_channel: { jobId, channel: "instagram" } },
      create: { jobId, channel: "instagram" },
      update: {},
    });
    if (publication.state === "published") {
      console.log(
        JSON.stringify({
          alreadyPublished: true,
          jobId,
          mediaId: publication.externalId,
          permalink: publication.permalink,
        }),
      );
      return;
    }
    if (["sending", "uncertain", "failed"].includes(publication.state))
      throw new Error("INSPECT_EXISTING_ATTEMPT_BEFORE_RETRY");
    if (!(await service.sourceStillMatches(job.snapshot)))
      throw new Error("SOURCE_CHANGED");
    const [marketed, reserved] = await Promise.all([
      dedup.marketedAssetKeys([job.snapshot], jobId),
      dedup.reservedAssetKeys([job.snapshot], [jobId], job.scheduledFor),
    ]);
    if (marketed.size || reserved.size)
      throw new Error("ASSET_ALREADY_MARKETED_OR_RESERVED");
    await media.probePublicMedia(jobId);
    const { account, token } = await ig.instagramToken();
    const items = job.media.filter((item) => item.channel === "instagram");
    if (items[0]?.name !== "feed.jpg" || items.length < 2 || items.length > 4)
      throw new Error("INVALID_CAROUSEL");
    let sending = false;
    try {
      if (!publication.containerId) {
        const containerId = await ig.createContainer(
          account.accountId,
          token,
          items.map((item) => security.mediaUrl(jobId, item.name)),
          job.caption,
        );
        publication = await db.marketingPublication.update({
          where: { id: publication.id },
          data: { containerId, state: "preparing" },
        });
      }
      for (let i = 0; i < 30; i++) {
        const status = await ig.containerStatus(publication.containerId, token);
        if (status.status_code === "FINISHED") break;
        if (status.status_code !== "IN_PROGRESS" || i === 29)
          throw new Error("CONTAINER_" + status.status_code);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      await service.assertWorkerLease();
      if ((await ig.instagramToken()).account.accountId !== account.accountId)
        throw new Error("ACCOUNT_CHANGED");
      await db.marketingPublication.update({
        where: { id: publication.id },
        data: {
          state: "sending",
          attemptCount: { increment: 1 },
          errorCode: null,
        },
      });
      sending = true;
      await db.marketingJob.update({
        where: { id: jobId },
        data: { status: "publishing" },
      });
      const result = await ig.publishContainer(
        account.accountId,
        publication.containerId,
        token,
      );
      if (!result.id) throw new Error("MISSING_PUBLISHED_ID");
      publication = await db.marketingPublication.update({
        where: { id: publication.id },
        data: {
          state: "published",
          externalId: String(result.id),
          publishedAt: new Date(),
          errorCode: null,
        },
      });
      await db.marketingJob.update({
        where: { id: jobId },
        data: { status: "completed", reason: null },
      });
      let details = {};
      try {
        details = await ig.graph(String(result.id), token, {
          fields: "id,permalink,media_type,caption,children{id,media_type}",
        });
      } catch {}
      if (details.permalink)
        await db.marketingPublication.update({
          where: { id: publication.id },
          data: { permalink: details.permalink },
        });
      console.log(
        JSON.stringify({
          published: true,
          username: account.username,
          jobId,
          mediaId: result.id,
          permalink: details.permalink || null,
          type: details.media_type,
          slides: details.children?.data?.length,
          caption: job.caption,
        }),
      );
    } catch (error) {
      const fresh = await db.marketingPublication.findUnique({
        where: { id: publication.id },
      });
      if (fresh.state !== "published") {
        const uncertain = sending && error.uncertain !== false;
        await db.marketingPublication.update({
          where: { id: publication.id },
          data: {
            state: uncertain ? "uncertain" : "preparing",
            errorCode: error.code || "PROVIDER_ERROR",
          },
        });
        await db.marketingJob.update({
          where: { id: jobId },
          data: {
            status: "review",
            reason: uncertain
              ? "DELIVERY_UNCERTAIN"
              : error.code || "PROVIDER_ERROR",
          },
        });
      }
      throw error;
    }
  });
}
(async () => {
  await db.agent.findFirstOrThrow({
    where: {
      jabatan: "OWNER",
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF" },
    },
    select: { id_agent: true },
  });
  if (process.argv[2] === "--prepare") await prepare();
  else if (process.argv[2] === "--publish") await publish(process.argv[3]);
  else throw new Error("USE_PREPARE_OR_PUBLISH_WITH_JOB_ID");
})()
  .catch((error) => {
    console.error(
      JSON.stringify({
        error: error.code || error.message || error.name,
        providerCode: error.providerCode,
        providerIssue: error.providerIssue,
        uncertain: error.uncertain,
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(process.exitCode || 0);
  });
