import "server-only";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import prisma from "@/lib/prisma";
import { type MarketingJob, type MarketingPublication } from "@prisma/client";
import { withInvestorRead } from "@/lib/investor-read.server";
import { getMarketingInvestorCandidates } from "@/lib/investor-cma-legacy.server";
import {
  assetIdentity,
  captionFor,
  eligibleAsset,
  EMPTY_METRICS,
  investorFilters,
  jakartaDate,
  nextSlot,
  normalizePhone,
  scheduledSlots,
  snapshotAsset,
  type AssetSnapshot,
  type Channel,
  type MarketingConfig,
} from "./domain";
import {
  getSettings,
  json,
  listJobs,
  recentAssetKeys,
  saveSettings,
} from "./store.server";
import { instagramSetup, MarketingError, mediaUrl } from "./security.server";
import { instagramConnectionReady } from "./instagram-credentials.server";
import {
  buildMarketingMedia,
  probePublicMedia,
  readMarketingMedia,
  type MarketingMedia,
} from "./media.server";
import {
  containerStatus,
  createContainer,
  graph,
  InstagramError,
  instagramComments,
  instagramMetrics,
  instagramToken,
  publishContainer,
  checkInstagramToken,
} from "./instagram.server";
import { whatsappRequest } from "./whatsapp.server";
import { canPrepareSlot, monthBounds } from "./planner";
import { manualPlan, planChannels, validPlanTime } from "./plan";
import {
  campaignPlan,
  campaignConfig,
  sameCampaignAsset,
  campaignCoversDay,
  campaignExecutionIssue,
} from "./campaign";
import {
  activeCampaignPeriods,
  pendingCampaignSummaries,
} from "./campaign-periods.server";
import { campaignAssetAvailable } from "./campaign-selection";
import { runCampaignReminders } from "./campaign-reminders.server";
import { marketedAssetKeys, reservedAssetKeys } from "./campaign-dedup.server";
const workerLease = new AsyncLocalStorage<{ token: string; lost: boolean }>();
export async function assertWorkerLease() {
  const context = workerLease.getStore();
  if (!context) return;
  const row = await prisma.marketingSettings.findUnique({
    where: { id: "company" },
    select: { leaseToken: true, leasedUntil: true },
  });
  if (
    context.lost ||
    row?.leaseToken !== context.token ||
    !row.leasedUntil ||
    row.leasedUntil <= new Date()
  )
    throw new MarketingError("LEASE_LOST", 409);
}

export async function connections() {
  const accounts = await prisma.marketingConnection.findMany({
    select: {
      id: true,
      accountId: true,
      tokenCipher: true,
      username: true,
      expiresAt: true,
      testedAt: true,
      lastError: true,
    },
  });
  const instagram = accounts.find((row) => row.id === "instagram");
  let whatsapp: {
    connected: boolean;
    phone: string | null;
    tested_at: number | null;
    contacts: { jid: string; name: string }[];
  } = { connected: false, phone: null, tested_at: null, contacts: [] };
  try {
    whatsapp = await whatsappRequest("status");
  } catch {}
  const setup = instagramSetup();
  return {
    environmentReady: setup.environmentReady,
    instagram: {
      connected: setup.ready && instagramConnectionReady(instagram),
      username: instagram?.username || null,
      expiresAt: instagram?.expiresAt || null,
      configured: setup.ready,
      setup,
      lastError: instagram?.lastError || null,
    },
    whatsapp: {
      ...whatsapp,
      tested: !!whatsapp.phone && !!whatsapp.tested_at,
      lastError: whatsapp.connected ? null : "WA_DISCONNECTED",
    },
  };
}
export async function ensureSlots(
  config: MarketingConfig,
  now = new Date(),
  lastTickAt?: Date | null,
) {
  const firstDay = new Date(
    jakartaDate(lastTickAt && lastTickAt < now ? lastTickAt : now) +
      "T00:00:00+07:00",
  );
  const end =
    new Date(jakartaDate(now) + "T00:00:00+07:00").getTime() + 2 * 86400000;
  const periods = await activeCampaignPeriods(
    jakartaDate(firstDay),
    jakartaDate(new Date(end)),
  );
  // Backfill outages spanning several days; past slots are recorded, never sent.
  for (let day = firstDay.getTime(); day < end; day += 86400000) {
    const covered = campaignCoversDay(periods, jakartaDate(new Date(day)));
    if (covered)
      await prisma.marketingJob.updateMany({
        where: {
          campaignId: null,
          plan: { equals: {} },
          status: "queued",
          scheduledFor: {
            gte: new Date(Math.max(day, now.getTime())),
            lt: new Date(day + 86400000),
          },
          publications: {
            none: {
              OR: [
                { attemptCount: { gt: 0 } },
                { state: { in: ["published", "sending", "uncertain"] } },
              ],
            },
          },
        },
        data: { status: "skipped", reason: "CAMPAIGN_SCHEDULE" },
      });
    if (!covered)
      await prisma.marketingJob.updateMany({
        where: {
          campaignId: null,
          plan: { equals: {} },
          status: "skipped",
          reason: "CAMPAIGN_SCHEDULE",
          scheduledFor: {
            gt: new Date(Math.max(day, now.getTime())),
            lt: new Date(day + 86400000),
          },
          publications: {
            none: {
              OR: [
                { attemptCount: { gt: 0 } },
                { state: { in: ["published", "sending", "uncertain"] } },
              ],
            },
          },
        },
        data: { status: "queued", reason: null },
      });
    await prisma.marketingJob.createMany({
      data: scheduledSlots(config, new Date(day)).map((date) => ({
        scheduledFor: date,
        settingsRevision: config.revision,
        status:
          covered || date.getTime() < now.getTime() - 120000
            ? "skipped"
            : "queued",
        reason: covered
          ? "CAMPAIGN_SCHEDULE"
          : date.getTime() < now.getTime() - 120000
            ? config.enabled
              ? "MISSED_SLOT"
              : "PAUSED"
            : null,
      })),
      skipDuplicates: true,
    });
  }
}
export async function plannerMonth(month: string) {
  const bounds = monthBounds(month);
  const jobs = await prisma.marketingJob.findMany({
    where: { scheduledFor: { gte: bounds.start, lt: bounds.end } },
    orderBy: { scheduledFor: "asc" },
    include: {
      publications: {
        include: { metrics: { orderBy: { fetchedAt: "desc" }, take: 1 } },
      },
    },
  });
  const startDay = jakartaDate(bounds.start);
  const endDay = jakartaDate(new Date(bounds.end.getTime() - 1));
  const [campaignPeriods, pendingCampaigns] = await Promise.all([
    activeCampaignPeriods(startDay, endDay),
    pendingCampaignSummaries(startDay, endDay),
  ]);
  const periods = [
    ...campaignPeriods,
    ...pendingCampaigns.filter((campaign) => !campaign.applied).map((campaign) => campaign.period),
  ];
  // Campaigns have no deletion flow. Include all retained identities so month,
  // status, draft edits and newly created campaigns cannot renumber older ones.
  const identities = periods.length ? await prisma.marketingCampaign.findMany({
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  }) : [];
  const appearance = new Map(identities.map((campaign, index) => [campaign.id, index]));
  return {
    month,
    jobs,
    now: new Date(),
    campaignPeriods: periods.map((period) => ({
      ...period,
      ...(period.plan ? { plan: { ...period.plan, appearanceIndex: appearance.get(period.plan.id) } } : {}),
    })),
    pendingCampaigns,
  };
}
export async function dashboard(page = 1, month = jakartaDate().slice(0, 7)) {
  monthBounds(month);
  const { row, config } = await getSettings();
  await ensureSlots(config, new Date(), row.lastTickAt);
  // Keep the planner truthful even when it is opened without a running cron.
  // An active worker retains ownership of any slot it is preparing.
  if (!row.leasedUntil || row.leasedUntil < new Date())
    await prisma.marketingJob.updateMany({
      where: {
        status: "queued",
        scheduledFor: { lt: new Date(Date.now() - 120000) },
        publications: { none: { attemptCount: { gt: 0 } } },
      },
      data: {
        status: "skipped",
        reason: config.enabled ? "MISSED_SLOT" : "PAUSED",
      },
    });
  const dayStart = new Date(jakartaDate() + "T00:00:00+07:00");
  const [connection, jobs, published, needsReview, planner] = await Promise.all(
    [
      connections(),
      listJobs(page),
      prisma.marketingPublication.groupBy({
        by: ["channel"],
        where: { state: "published", publishedAt: { gte: dayStart } },
        _count: true,
      }),
      prisma.marketingPublication.count({ where: { state: "uncertain" } }),
      plannerMonth(month),
    ],
  );
  return {
    config,
    connection,
    jobs,
    planner,
    summary: {
      nextSlot: nextSlot(config),
      lastTickAt: row.lastTickAt,
      lastError: row.lastError,
      published,
      needsReview,
    },
  };
}
/** Reuse an approved campaign slot as the activation sample when one exists. */
async function activationPreview(config: MarketingConfig) {
  async function prepareSample(
    jobId: string,
    asset: AssetSnapshot,
    sampleConfig: MarketingConfig,
  ) {
    try {
      await readMarketingMedia(jobId, "feed.jpg");
      return true;
    } catch {
      try {
        await buildMarketingMedia(jobId, asset, sampleConfig);
        return true;
      } catch {
        return false;
      }
    }
  }

  const now = new Date();
  const campaignJobs = await prisma.marketingJob.findMany({
    where: {
      campaignId: { not: null },
      status: "queued",
      scheduledFor: { gt: now },
      campaign: { is: { state: "running" } },
    },
    include: { campaign: true },
    orderBy: { scheduledFor: "asc" },
    take: 3,
  });
  for (const job of campaignJobs) {
    const plan = campaignPlan(job);
    const asset = job.snapshot as unknown as AssetSnapshot;
    if (
      !plan?.listingId ||
      asset.id !== plan.listingId ||
      campaignExecutionIssue(job.campaign, job.scheduledFor, now)
    )
      continue;
    if (
      await prepareSample(
        job.id,
        asset,
        campaignConfig(config, plan.criteria),
      )
    )
      return job.id;
  }

  const preparedJobs = await prisma.marketingJob.findMany({
    where: { listingId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });
  for (const job of preparedJobs) {
    const asset = job.snapshot as unknown as AssetSnapshot;
    if (asset.id !== job.listingId) continue;
    if (await prepareSample(job.id, asset, config)) return job.id;
  }
  return null;
}
export async function updateConfiguration(config: MarketingConfig) {
  if (config.enabled) {
    if (!normalizePhone(config.companyPhone))
      throw new MarketingError("COMPANY_PHONE_REQUIRED");
    const connection = await connections();
    if (
      config.instagram &&
      (!connection.environmentReady || !connection.instagram.connected)
    )
      throw new MarketingError("ACCOUNT_NOT_READY");
    if (
      config.whatsapp &&
      (!connection.whatsapp.connected ||
        !connection.whatsapp.tested ||
        !config.whatsappAudience.length)
    )
      throw new MarketingError("WA_TEST_REQUIRED");
    if (config.whatsapp) {
      const contacts = new Set(
        connection.whatsapp.contacts.map((contact) => contact.jid),
      );
      if (config.whatsappAudience.some((jid) => !contacts.has(jid)))
        throw new MarketingError("INVALID_AUDIENCE");
      config = { ...config, whatsappAccount: connection.whatsapp.phone };
    }
    const previewId = await activationPreview(config);
    if (!previewId) throw new MarketingError("PREVIEW_REQUIRED");
    if (config.instagram) await probePublicMedia(previewId);
  }
  return saveSettings(config);
}
export async function lease<T>(run: () => Promise<T>): Promise<T> {
  await getSettings();
  const token = randomUUID(),
    now = new Date();
  const acquired = await prisma.marketingSettings.updateMany({
    where: {
      id: "company",
      OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }],
    },
    data: {
      leaseToken: token,
      leasedUntil: new Date(now.getTime() + 10 * 60000),
    },
  });
  if (!acquired.count) throw new MarketingError("WORKER_BUSY", 409);
  const context = { token, lost: false };
  let renewing = false;
  const heartbeat = setInterval(() => {
    if (renewing) return;
    renewing = true;
    void prisma.marketingSettings
      .updateMany({
        where: { id: "company", leaseToken: token },
        data: { leasedUntil: new Date(Date.now() + 10 * 60000) },
      })
      .then((result) => {
        if (!result.count) context.lost = true;
      })
      .catch(() => {
        context.lost = true;
      })
      .finally(() => {
        renewing = false;
      });
  }, 60000);
  heartbeat.unref();
  try {
    return await workerLease.run(context, run);
  } finally {
    clearInterval(heartbeat);
    await prisma.marketingSettings.updateMany({
      where: { id: "company", leaseToken: token },
      data: { leaseToken: null, leasedUntil: null },
    });
  }
}
export async function prepareMarketingJob(
  job: MarketingJob,
  config: MarketingConfig,
) {
  const campaign = campaignPlan(job);
  if (job.campaignId && !campaign)
    throw new MarketingError("CAMPAIGN_REVIEW_REQUIRED");
  if (campaign) {
    if (!campaign.listingId)
      throw new MarketingError("CAMPAIGN_NO_ELIGIBLE_ASSET");
    const row = await prisma.marketingCampaign.findUnique({
      where: { id: campaign.campaignId },
    });
    const issue = campaignExecutionIssue(row, job.scheduledFor);
    if (issue) throw new MarketingError(issue);
    config = campaignConfig(config, campaign.criteria);
  }
  const excluded = await recentAssetKeys(
    config.cooldownDays,
    job.scheduledFor,
    job.id,
  );
  const selectionTime = new Date(
    Math.max(Date.now(), job.scheduledFor.getTime()),
  );
  const filters = investorFilters(config);
  const selectedId = campaign?.listingId || manualPlan(job)?.listingId;
  if (selectedId) filters.query = selectedId;
  const deadline = Date.now() + 4 * 60000;
  let offset = 0,
    anyEligible = false;
  // Ranking precedes all batching; scan beyond the first Investor page.
  while (true) {
    const batch = await withInvestorRead((reader) =>
      getMarketingInvestorCandidates(
        reader,
        filters,
        excluded,
        offset,
        30,
        (item) =>
          (!selectedId || item.id === selectedId) &&
          eligibleAsset(item, config, selectionTime) &&
          (!campaign ||
            campaignAssetAvailable(snapshotAsset(item), selectionTime)),
      ),
    );
    const [marketed, reserved] = await Promise.all([
      marketedAssetKeys(batch.items.map(snapshotAsset), job.id),
      reservedAssetKeys(
        batch.items.map(snapshotAsset),
        [job.id],
        selectedId ? job.scheduledFor : undefined,
      ),
    ]);
    for (const item of batch.items) {
      if (Date.now() > deadline)
        throw new MarketingError("PREPARATION_TIMEOUT", 503);
      if (
        (selectedId && item.id !== selectedId) ||
        !eligibleAsset(item, config, selectionTime) ||
        (campaign &&
          !campaignAssetAvailable(snapshotAsset(item), selectionTime)) ||
        (!item.imageUrls?.length && !item.imageUrl)
      )
        continue;
      if (marketed.has(assetIdentity(item))) {
        if (selectedId) throw new MarketingError("ASSET_ALREADY_MARKETED");
        continue;
      }
      if (reserved.has(assetIdentity(item))) {
        if (selectedId) throw new MarketingError("SELECTED_ASSET_UNAVAILABLE");
        continue;
      }
      if (!(await sourceStillMatches(snapshotAsset(item)))) continue;
      anyEligible = true;
      const snapshot = snapshotAsset(item);
      if (
        campaign &&
        !sameCampaignAsset(snapshot, job.snapshot as AssetSnapshot)
      )
        throw new MarketingError("CAMPAIGN_REVIEW_REQUIRED");
      try {
        const media = await buildMarketingMedia(job.id, snapshot, config);
        return await prisma.marketingJob.update({
          where: { id: job.id },
          data: {
            listingId: item.id,
            assetKey: assetIdentity(item),
            snapshot: json(snapshot),
            caption: campaign ? job.caption : captionFor(snapshot, config),
            media: json(media),
            reason: null,
            settingsRevision: config.revision,
          },
        });
      } catch (error) {
        if (
          !(error instanceof MarketingError) ||
          error.code !== "PHOTO_UNAVAILABLE"
        )
          throw error;
      }
    }
    offset += batch.items.length;
    if (!batch.items.length || offset >= batch.total) break;
  }
  throw new MarketingError(
    anyEligible
      ? "PHOTO_UNAVAILABLE"
      : selectedId
        ? "SELECTED_ASSET_UNAVAILABLE"
        : "NO_ELIGIBLE_ASSET",
  );
}
export async function previewNext() {
  return lease(async () => {
    const { config } = await getSettings();
    await ensureSlots(config);
    const job = await prisma.marketingJob.findFirst({
      where: { scheduledFor: { gt: new Date() }, status: "queued" },
      orderBy: { scheduledFor: "asc" },
    });
    if (!job) throw new MarketingError("NO_SCHEDULE");
    return prepareMarketingJob(job, config);
  });
}
export async function preparePlannedSlot(when: string) {
  return lease(async () => {
    const { config } = await getSettings();
    const scheduledFor = new Date(when);
    const existing = await prisma.marketingJob.findUnique({
      where: { scheduledFor },
    });
    if (
      !(manualPlan(existing) || campaignPlan(existing)
        ? validPlanTime(scheduledFor)
        : canPrepareSlot(config, scheduledFor))
    )
      throw new MarketingError("INVALID_PLANNING_SLOT", 400);
    const job = await prisma.marketingJob.upsert({
      where: { scheduledFor },
      create: { scheduledFor, settingsRevision: config.revision },
      update: {},
      include: { publications: true },
    });
    if (
      job.status !== "queued" ||
      job.publications.some((item) => item.attemptCount > 0)
    )
      throw new MarketingError("PLANNING_SLOT_LOCKED", 409);
    try {
      return await prepareMarketingJob(job, config);
    } catch (error) {
      if (error instanceof MarketingError)
        await prisma.marketingJob.update({
          where: { id: job.id },
          data: { reason: error.code },
        });
      throw error;
    }
  });
}
export async function testWhatsapp(phone: string) {
  const jid = normalizePhone(phone) + "@s.whatsapp.net";
  if (!/^[1-9]\d{6,14}@s\.whatsapp\.net$/.test(jid))
    throw new MarketingError("INVALID_AUDIENCE");
  const { config } = await getSettings();
  const job = await previewNext();
  const result = await whatsappRequest("statuses", {
    id: randomUUID(),
    imageBase64: (await readMarketingMedia(job.id, "story.jpg")).toString(
      "base64",
    ),
    caption: "Uji Status " + config.companyName,
    audience: [jid],
    test: true,
  });
  if (result.state !== "published")
    throw new MarketingError("DELIVERY_UNCERTAIN", 409);
  return {
    state: "published",
    message:
      "Status uji dikirim melalui koneksi WhatsApp. Periksa tampilannya di ponsel kontak uji.",
    testedAt: result.sent_at,
  };
}
async function freshSnapshot(job: MarketingJob, config: MarketingConfig) {
  const batch = await withInvestorRead((reader) =>
    getMarketingInvestorCandidates(
      reader,
      { ...investorFilters(config), query: job.listingId! },
      new Set(),
      0,
      30,
      (item) => item.id === job.listingId && eligibleAsset(item, config),
    ),
  );
  const item = batch.items.find((candidate) => candidate.id === job.listingId);
  const snapshot =
    item && eligibleAsset(item, config) ? snapshotAsset(item) : null;
  return snapshot && (await sourceStillMatches(snapshot)) ? snapshot : null;
}
/** Stored valuations may lag ingestion. Publishing always verifies the public source. */
export async function sourceStillMatches(asset: AssetSnapshot) {
  const source = await prisma.listing.findUnique({
    where: { id_property: BigInt(asset.id) },
    select: {
      status_tayang: true,
      bukan_properti: true,
      jenis_transaksi: true,
      harga: true,
      harga_promo: true,
      nilai_limit_lelang: true,
      tanggal_lelang: true,
      gambar: true,
      alamat_lengkap: true,
      luas_tanah: true,
      legalitas: true,
    },
  });
  if (
    !source ||
    source.status_tayang !== "TERSEDIA" ||
    source.bukan_properti ||
    source.jenis_transaksi !== asset.category
  )
    return false;
  const regular = Number(source.harga),
    promo = Number(source.harga_promo),
    limit = Number(source.nilai_limit_lelang);
  const price =
    source.jenis_transaksi === "LELANG"
      ? limit > 0
        ? limit
        : regular
      : promo > 0 && promo < regular
        ? promo
        : regular;
  if (
    price !== asset.price ||
    (source.luas_tanah === null ? null : Number(source.luas_tanah)) !==
      asset.landArea ||
    (source.alamat_lengkap || "") !== asset.address ||
    (source.legalitas || null) !== (asset.certificateType || null)
  )
    return false;
  if (
    source.jenis_transaksi === "LELANG" &&
    (!source.tanggal_lelang ||
      source.tanggal_lelang.getTime() <= Date.now() ||
      source.tanggal_lelang.toISOString() !== asset.auctionDate)
  )
    return false;
  const images = new Set(
    (source.gambar || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return (
    asset.images.length > 0 && asset.images.every((image) => images.has(image))
  );
}
async function instagramPublish(
  publication: MarketingPublication,
  job: MarketingJob,
) {
  const { account, token } = await instagramToken();
  let containerId = publication.containerId;
  if (!containerId) {
    const media = job.media as MarketingMedia[];
    containerId = await createContainer(
      account.accountId,
      token,
      media
        .filter((item) => item.channel === "instagram")
        .map((item) => mediaUrl(job.id, item.name)),
      job.caption,
    );
    if (!containerId || !/^\d+$/.test(containerId))
      throw new InstagramError("PROVIDER_ERROR");
    await prisma.marketingPublication.update({
      where: { id: publication.id },
      data: { containerId, state: "preparing" },
    });
  }
  const status = await containerStatus(containerId, token);
  if (status.status_code === "IN_PROGRESS") return "preparing";
  if (status.status_code === "PUBLISHED") {
    // Resolve the original container against owned media before ever retrying.
    const media = await graph(account.accountId + "/media", token, {
      fields: "id,caption,timestamp,permalink",
      limit: "100",
    });
    const matches = (media.data || []).filter(
      (item: { caption: string; timestamp: string }) =>
        item.caption === job.caption &&
        Date.parse(item.timestamp) >= job.scheduledFor.getTime() - 300000,
    );
    if (matches.length !== 1)
      throw new InstagramError("DELIVERY_UNCERTAIN", true);
    await markPublished(publication.id, matches[0].id, matches[0].permalink);
    return "published";
  }
  if (status.status_code !== "FINISHED")
    throw new InstagramError("PROVIDER_ERROR");
  if (publication.state === "uncertain" || publication.state === "sending")
    throw new InstagramError("DELIVERY_UNCERTAIN", true);
  await prisma.marketingPublication.update({
    where: { id: publication.id },
    data: { state: "sending" },
  });
  await assertWorkerLease();
  const result = await publishContainer(account.accountId, containerId, token);
  if (!result.id) throw new InstagramError("DELIVERY_UNCERTAIN", true);
  await markPublished(publication.id, result.id);
  // A permalink lookup failure cannot undo the confirmed publication.
  try {
    const details = await graph(String(result.id), token, {
      fields: "permalink",
    });
    if (details.permalink)
      await prisma.marketingPublication.update({
        where: { id: publication.id },
        data: { permalink: details.permalink },
      });
  } catch {}
  return "published";
}
async function markPublished(
  id: string,
  externalId: string,
  permalink?: string,
) {
  await prisma.marketingPublication.update({
    where: { id },
    data: {
      state: "published",
      externalId: String(externalId),
      permalink: permalink || null,
      publishedAt: new Date(),
      errorCode: null,
      nextAttemptAt: null,
    },
  });
}
async function send(
  publication: MarketingPublication,
  job: MarketingJob,
  config: MarketingConfig,
) {
  try {
    await prisma.marketingPublication.update({
      where: { id: publication.id },
      data: { attemptCount: { increment: 1 }, errorCode: null },
    });
    if (publication.channel === "instagram") {
      await instagramPublish(publication, job);
    } else {
      if (
        publication.state === "sending" ||
        publication.state === "uncertain"
      ) {
        const evidence = await whatsappRequest("statuses/" + publication.id);
        if (evidence.state !== "published")
          throw new MarketingError("DELIVERY_UNCERTAIN");
        await markPublished(publication.id, evidence.message_id);
        return;
      }
      const status = await whatsappRequest("status");
      if (!status.connected) throw new MarketingError("WA_DISCONNECTED");
      if (!status.tested_at) throw new MarketingError("WA_TEST_REQUIRED");
      if (!config.whatsappAccount || status.phone !== config.whatsappAccount)
        throw new MarketingError("WA_ACCOUNT_CHANGED");
      const body = {
        id: publication.id,
        imageBase64: (await readMarketingMedia(job.id, "story.jpg")).toString(
          "base64",
        ),
        caption: "",
        audience: config.whatsappAudience,
        test: false,
      };
      await prisma.marketingPublication.update({
        where: { id: publication.id },
        data: { state: "sending" },
      });
      await assertWorkerLease();
      const result = await whatsappRequest("statuses", body);
      if (result.state !== "published")
        throw new MarketingError("DELIVERY_UNCERTAIN");
      await markPublished(publication.id, result.message_id);
    }
  } catch (error) {
    const row = await prisma.marketingPublication.findUniqueOrThrow({
      where: { id: publication.id },
    });
    if (row.state === "published") return;
    const knownRejected =
      (error instanceof InstagramError && !error.uncertain) ||
      (error instanceof MarketingError && error.code === "WA_DISCONNECTED");
    const ambiguous =
      (row.state === "sending" && !knownRejected) ||
      publication.state === "uncertain";
    const retryable =
      !ambiguous &&
      row.attemptCount < 3 &&
      ((error instanceof InstagramError &&
        (error.retryable || (error.uncertain && !row.containerId))) ||
        (error instanceof MarketingError && error.code === "WA_DISCONNECTED"));
    const code = ambiguous
      ? "DELIVERY_UNCERTAIN"
      : error instanceof MarketingError
        ? error.code
        : "PROVIDER_ERROR";
    await prisma.marketingPublication.update({
      where: { id: row.id },
      data: {
        state: ambiguous ? "uncertain" : retryable ? "pending" : "failed",
        errorCode: code,
        nextAttemptAt: retryable
          ? new Date(Date.now() + row.attemptCount * 60000)
          : null,
      },
    });
    if (code === "TOKEN_EXPIRED")
      await prisma.marketingConnection.updateMany({
        where: { id: "instagram" },
        data: { lastError: code },
      });
  }
}
export async function processMarketingJob(
  job: MarketingJob,
  config: MarketingConfig,
) {
  let publications = await prisma.marketingPublication.findMany({
    where: { jobId: job.id },
  });
  const campaign = campaignPlan(job);
  if (job.campaignId && !campaign) {
    await prisma.marketingJob.update({
      where: { id: job.id },
      data: { status: "review", reason: "CAMPAIGN_REVIEW_REQUIRED" },
    });
    return;
  }
  if (campaign) {
    const row = await prisma.marketingCampaign.findUnique({
      where: { id: campaign.campaignId },
    });
    const issue = campaignExecutionIssue(
      row,
      job.scheduledFor,
      new Date(),
      true,
    );
    if (issue) {
      const ended =
        issue === "CAMPAIGN_ENDED" || issue === "CAMPAIGN_OUTSIDE_PERIOD";
      if (ended)
        await prisma.marketingPublication.updateMany({
          where: { jobId: job.id, state: { in: ["pending", "preparing"] } },
          data: { state: "skipped", errorCode: issue },
        });
      await prisma.marketingJob.update({
        where: { id: job.id },
        data: {
          status: publications.some((p) =>
            ["sending", "uncertain"].includes(p.state),
          )
            ? "review"
            : publications.some((p) => p.state === "published")
              ? "partial"
              : ended
                ? "skipped"
                : issue === "CAMPAIGN_REVIEW_REQUIRED"
                  ? "review"
                  : "paused",
          reason: issue,
        },
      });
      return;
    }
    config = campaignConfig(config, campaign.criteria);
  }
  if (job.scheduledFor.getTime() < Date.now() - 3600000) {
    await prisma.marketingPublication.updateMany({
      where: { jobId: job.id, state: { in: ["pending", "preparing"] } },
      data: { state: "skipped", errorCode: "MISSED_SLOT" },
    });
    await prisma.marketingJob.update({
      where: { id: job.id },
      data: {
        status: publications.some((item) =>
          ["sending", "uncertain"].includes(item.state),
        )
          ? "review"
          : publications.some((item) => item.state === "published")
            ? "partial"
            : "skipped",
        reason: "MISSED_SLOT",
      },
    });
    return;
  }
  if (
    !job.listingId ||
    (!campaign &&
      manualPlan(job) &&
      job.settingsRevision !== config.revision &&
      !publications.some((item) => item.attemptCount > 0))
  ) {
    try {
      job = await prepareMarketingJob(job, config);
    } catch (error) {
      if (!(error instanceof MarketingError)) throw error;
      await prisma.marketingJob.update({
        where: { id: job.id },
        data: {
          status: campaign ? "review" : "skipped",
          reason: campaign ? "CAMPAIGN_REVIEW_REQUIRED" : error.code,
        },
      });
      return;
    }
  }
  if (job.scheduledFor > new Date()) return;
  // Resolve attempts left behind by a disconnected caller before creating new sends.
  for (const row of publications.filter((item) =>
    ["uncertain", "sending"].includes(item.state),
  ))
    await send(row, job, config);
  publications = await prisma.marketingPublication.findMany({
    where: { jobId: job.id },
  });
  let fresh = await freshSnapshot(job, config);
  const [marketed, reserved] = fresh
    ? await Promise.all([
        marketedAssetKeys([fresh], job.id),
        reservedAssetKeys([fresh], [job.id], job.scheduledFor),
      ])
    : [new Set<string>(), new Set<string>()];
  if (fresh && (marketed.has(fresh.assetKey) || reserved.has(fresh.assetKey))) {
    const duplicateReason = marketed.has(fresh.assetKey)
      ? "ASSET_ALREADY_MARKETED"
      : "SELECTED_ASSET_UNAVAILABLE";
    await prisma.marketingJob.update({
      where: { id: job.id },
      data: { status: "review", reason: duplicateReason },
    });
    await prisma.marketingPublication.updateMany({
      where: { jobId: job.id, state: { in: ["pending", "preparing"] } },
      data: { state: "skipped", errorCode: duplicateReason },
    });
    return;
  }
  const campaignReserved = campaign
    ? await recentAssetKeys(config.cooldownDays, job.scheduledFor, job.id)
    : null;
  if (
    campaign &&
    (!fresh ||
      !campaignAssetAvailable(fresh) ||
      campaignReserved?.has(job.assetKey || "") ||
      !sameCampaignAsset(fresh, job.snapshot as AssetSnapshot) ||
      !(await sourceStillMatches(fresh)))
  ) {
    await prisma.marketingPublication.updateMany({
      where: { jobId: job.id, state: { in: ["pending", "preparing"] } },
      data: { state: "skipped", errorCode: "CAMPAIGN_REVIEW_REQUIRED" },
    });
    await prisma.marketingJob.update({
      where: { id: job.id },
      data: { status: "review", reason: "CAMPAIGN_REVIEW_REQUIRED" },
    });
    return;
  }
  if (
    !campaign &&
    !fresh &&
    job.settingsRevision === config.revision &&
    !publications.some((item) =>
      ["published", "sending", "uncertain"].includes(item.state),
    )
  ) {
    try {
      job = await prepareMarketingJob(job, config);
      fresh = job.snapshot as AssetSnapshot;
      await prisma.marketingPublication.updateMany({
        where: { jobId: job.id },
        data: { containerId: null },
      });
    } catch (error) {
      if (!(error instanceof MarketingError)) throw error;
    }
  }
  if (!fresh || (!campaign && job.settingsRevision !== config.revision)) {
    await prisma.marketingPublication.updateMany({
      where: { jobId: job.id, state: { in: ["pending", "preparing"] } },
      data: {
        state: "skipped",
        errorCode: fresh ? "SETTINGS_CHANGED" : "NO_ELIGIBLE_ASSET",
      },
    });
    await prisma.marketingJob.update({
      where: { id: job.id },
      data: {
        status: publications.some((item) => item.state === "published")
          ? "partial"
          : publications.some((item) => item.state === "uncertain")
            ? "review"
            : "skipped",
        reason: fresh ? "SETTINGS_CHANGED" : "NO_ELIGIBLE_ASSET",
      },
    });
    return;
  }
  const snapshot = job.snapshot as AssetSnapshot;
  if (!campaign && JSON.stringify(fresh) !== JSON.stringify(snapshot)) {
    if (
      publications.some((item) =>
        ["published", "uncertain", "sending"].includes(item.state),
      )
    ) {
      await prisma.marketingPublication.updateMany({
        where: { jobId: job.id, state: { in: ["pending", "preparing"] } },
        data: { state: "skipped", errorCode: "SETTINGS_CHANGED" },
      });
    } else {
      job = await prisma.marketingJob.update({
        where: { id: job.id },
        data: {
          snapshot: json(fresh),
          caption: captionFor(fresh, config),
          media: json(await buildMarketingMedia(job.id, fresh, config)),
        },
      });
      await prisma.marketingPublication.updateMany({
        where: { jobId: job.id },
        data: { containerId: null },
      });
    }
  }
  if (!publications.length) {
    for (const channel of planChannels(job, config))
      await prisma.marketingPublication.upsert({
        where: { jobId_channel: { jobId: job.id, channel } },
        create: { jobId: job.id, channel },
        update: {},
      });
  }
  await prisma.marketingJob.update({
    where: { id: job.id },
    data: { status: "publishing" },
  });
  publications = await prisma.marketingPublication.findMany({
    where: { jobId: job.id },
  });
  for (const publication of publications) {
    if (
      !["pending", "preparing"].includes(publication.state) ||
      (publication.nextAttemptAt && publication.nextAttemptAt > new Date())
    )
      continue;
    const current = (await getSettings()).config;
    if (!current.enabled || current.revision !== config.revision) break;
    if (!current[publication.channel as Channel]) {
      await prisma.marketingPublication.update({
        where: { id: publication.id },
        data: { state: "skipped", errorCode: "CHANNEL_DISABLED" },
      });
      continue;
    }
    if (
      (campaign && !campaignAssetAvailable(job.snapshot as AssetSnapshot)) ||
      !(await sourceStillMatches(job.snapshot as AssetSnapshot))
    ) {
      await prisma.marketingPublication.update({
        where: { id: publication.id },
        data: {
          state: "skipped",
          errorCode: campaign
            ? "CAMPAIGN_REVIEW_REQUIRED"
            : "NO_ELIGIBLE_ASSET",
        },
      });
      continue;
    }
    const asset = job.snapshot as AssetSnapshot;
    const [publishedKeys, reservedKeys] = await Promise.all([
      marketedAssetKeys([asset], job.id),
      reservedAssetKeys([asset], [job.id], job.scheduledFor),
    ]);
    if (publishedKeys.has(asset.assetKey) || reservedKeys.has(asset.assetKey)) {
      await prisma.marketingPublication.update({
        where: { id: publication.id },
        data: {
          state: "skipped",
          errorCode: publishedKeys.has(asset.assetKey)
            ? "ASSET_ALREADY_MARKETED"
            : "SELECTED_ASSET_UNAVAILABLE",
        },
      });
      continue;
    }
    await send(publication, job, current);
  }
  const states = (
    await prisma.marketingPublication.findMany({
      where: { jobId: job.id },
      select: { state: true },
    })
  ).map((item) => item.state);
  const status = states.every((state) => state === "published")
    ? "completed"
    : states.some((state) =>
          ["pending", "preparing", "sending"].includes(state),
        )
      ? "publishing"
      : states.includes("uncertain")
        ? "review"
        : states.includes("published")
          ? "partial"
          : "skipped";
  await prisma.marketingJob.update({ where: { id: job.id }, data: { status } });
}
export async function syncMetrics(publicationId: string) {
  const publication = await prisma.marketingPublication.findUnique({
    where: { id: publicationId },
  });
  if (
    !publication ||
    publication.state !== "published" ||
    publication.errorCode === "MEDIA_DELETED" ||
    !publication.externalId
  )
    throw new MarketingError("NOT_FOUND", 404);
  let result: { values: object; reason: string | null };
  try {
    if (publication.channel === "instagram") {
      const { token } = await instagramToken();
      result = await instagramMetrics(publication.externalId, token);
    } else {
      const evidence = await whatsappRequest("statuses/" + publication.id);
      result = {
        values: { ...EMPTY_METRICS, ...evidence.values },
        reason: evidence.reason || null,
      };
    }
  } catch (error) {
    // Preserve last successful counts on provider failure.
    await prisma.marketingPublication.updateMany({
      where: {
        id: publication.id,
        OR: [{ errorCode: null }, { errorCode: { not: "MEDIA_DELETED" } }],
      },
      data: {
        errorCode:
          error instanceof MarketingError ? error.code : "METRICS_UNAVAILABLE",
        lastSyncedAt: new Date(),
      },
    });
    throw error;
  }
  await prisma.$transaction([
    prisma.marketingMetric.create({
      data: {
        publicationId,
        values: json(result.values),
        reason: result.reason,
      },
    }),
    prisma.marketingPublication.updateMany({
      where: {
        id: publicationId,
        OR: [{ errorCode: null }, { errorCode: { not: "MEDIA_DELETED" } }],
      },
      data: { lastSyncedAt: new Date(), errorCode: null },
    }),
  ]);
  return result;
}
export async function commentsFor(publicationId: string, after?: string) {
  const row = await prisma.marketingPublication.findUnique({
    where: { id: publicationId },
  });
  if (
    !row ||
    row.channel !== "instagram" ||
    row.errorCode === "MEDIA_DELETED" ||
    !row.externalId ||
    row.state !== "published"
  )
    throw new MarketingError("NOT_FOUND", 404);
  return instagramComments(
    row.externalId,
    (await instagramToken()).token,
    after,
  );
}
export async function reconcilePublication(id: string) {
  return lease(async () => {
    const publication = await prisma.marketingPublication.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!publication || !["uncertain", "sending"].includes(publication.state))
      throw new MarketingError("NOT_FOUND", 404);
    await send(
      { ...publication, state: "uncertain" },
      publication.job,
      (await getSettings()).config,
    );
    const states = (
      await prisma.marketingPublication.findMany({
        where: { jobId: publication.jobId },
      })
    ).map((item) => item.state);
    await prisma.marketingJob.update({
      where: { id: publication.jobId },
      data: {
        status: states.every((state) => state === "published")
          ? "completed"
          : states.includes("uncertain")
            ? "review"
            : "partial",
      },
    });
    return {
      state: (
        await prisma.marketingPublication.findUniqueOrThrow({ where: { id } })
      ).state,
    };
  });
}
export async function runMarketingTick() {
  try {
    return await lease(async () => {
      const now = new Date(),
        { row, config } = await getSettings();
      const reminders = await runCampaignReminders(now, assertWorkerLease);
      const { refreshCampaignQueues } = await import("./campaigns.server");
      await refreshCampaignQueues(now);
      await ensureSlots(config, now, row.lastTickAt);
      await prisma.marketingSettings.update({
        where: { id: "company" },
        data: { lastTickAt: now, lastError: null },
      });
      await prisma.marketingJob.updateMany({
        where: {
          status: "queued",
          scheduledFor: { lt: new Date(now.getTime() - 120000) },
        },
        data: {
          status: "skipped",
          reason: config.enabled ? "MISSED_SLOT" : "PAUSED",
        },
      });
      if (config.enabled) {
        const job = await prisma.marketingJob.findFirst({
          where: {
            OR: [
              {
                status: "queued",
                scheduledFor: { lte: new Date(now.getTime() + 10 * 60000) },
              },
              { status: "publishing" },
            ],
          },
          orderBy: { scheduledFor: "asc" },
        });
        if (job) await processMarketingJob(job, config);
      }
      try {
        if (
          await prisma.marketingConnection.count({ where: { id: "instagram" } })
        )
          await checkInstagramToken();
      } catch (error) {
        await prisma.marketingConnection.updateMany({
          where: { id: "instagram" },
          data: {
            lastError:
              error instanceof MarketingError ? error.code : "PROVIDER_ERROR",
          },
        });
      }
      const due = await prisma.marketingPublication.findMany({
        where: {
          state: "published",
          OR: [
            {
              channel: "instagram",
              publishedAt: { gte: new Date(Date.now() - 30 * 86400000) },
            },
            {
              channel: "whatsapp",
              publishedAt: { gte: new Date(Date.now() - 86400000) },
            },
          ],
          AND: [
            {
              OR: [
                { errorCode: null },
                { errorCode: { not: "MEDIA_DELETED" } },
              ],
            },
            {
              OR: [
                { lastSyncedAt: null },
                { lastSyncedAt: { lt: new Date(Date.now() - 30 * 60000) } },
              ],
            },
          ],
        },
        orderBy: [
          { lastSyncedAt: { sort: "asc", nulls: "first" } },
          { publishedAt: "desc" },
        ],
        take: 4,
      });
      await Promise.allSettled(
        due.map((publication) => syncMetrics(publication.id)),
      );
      return { ok: true, enabled: config.enabled, reminders };
    });
  } catch (error) {
    if (!(error instanceof MarketingError) || error.code !== "WORKER_BUSY")
      await prisma.marketingSettings
        .updateMany({
          where: { id: "company" },
          data: {
            lastError:
              error instanceof MarketingError ? error.code : "PROVIDER_ERROR",
          },
        })
        .catch(() => {});
    throw error;
  }
}
