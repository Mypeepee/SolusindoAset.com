import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withInvestorRead } from "@/lib/investor-read.server";
import {
  getMarketingInvestorCandidates,
  getMarketingInvestorScope,
} from "@/lib/investor-cma-legacy.server";
import { diagnoseCampaignInventory } from "./campaign-inventory";
import {
  campaignBatch,
  campaignPreparationDates,
  campaignQueueState,
} from "./campaign-batches";
import { marketedAssetKeys, reservedAssetKeys } from "./campaign-dedup.server";
import { campaignDayAfter } from "./campaign-batches";
import type { CampaignQueue } from "./campaign-queue";
import type { AssetSnapshot } from "./domain";
import type { InvestorListing } from "@/lib/investor-deals";
import {
  assetIdentity,
  eligibleAsset,
  investorFilters,
  jakartaDate,
  snapshotAsset,
  type MarketingConfig,
} from "./domain";
import {
  campaignBriefSchema,
  storedCampaignBriefSchema,
  campaignPeriodEnded,
  campaignCaption,
  campaignConfig,
  campaignCriteria,
  campaignInventorySchema,
  campaignSchedule,
  storedCampaignBrief,
  sameCampaignAsset,
  type CampaignBrief,
  type CampaignDetail,
  type CampaignRecord,
  type CampaignProposal,
  type CampaignSlot,
  type CampaignInventoryInput,
  type CampaignInventory,
} from "./campaign";
import { getSettings, json } from "./store.server";
import { assertWorkerLease, lease, sourceStillMatches } from "./service.server";
import { buildMarketingMedia } from "./media.server";
import { MarketingError } from "./security.server";
import {
  campaignAssetAvailable,
  campaignExposureHistory,
  CAMPAIGN_POLICY_VERSION,
  freshAssetOrder,
  selectCampaignAssets,
} from "./campaign-selection";
const publicationInclude = {
  publications: {
    include: { metrics: { orderBy: { fetchedAt: "desc" as const }, take: 1 } },
  },
};
async function requireCampaign(id: string, revision?: number) {
  const row = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!row) throw new MarketingError("CAMPAIGN_NOT_FOUND", 404);
  if (revision !== undefined && row.revision !== revision)
    throw new MarketingError("CAMPAIGN_CONFLICT", 409);
  return row;
}
function assertPeriod(
  brief: Pick<CampaignBrief, "startDate" | "endDate">,
  now = new Date(),
) {
  if (
    brief.endDate < jakartaDate(now) ||
    brief.startDate > jakartaDate(new Date(now.getTime() + 90 * 86400000)) ||
    brief.endDate > jakartaDate(new Date(now.getTime() + 90 * 86400000)) ||
    brief.endDate < brief.startDate ||
    Date.parse(brief.endDate) - Date.parse(brief.startDate) > 89 * 86400000
  )
    throw new MarketingError("CAMPAIGN_INVALID_PERIOD");
}
function replaceable(
  job: {
    campaignId: string | null;
    status: string;
    publications: { attemptCount: number; state: string }[];
  },
  id: string,
) {
  return (
    job.campaignId === id &&
    ["queued", "paused", "review", "skipped"].includes(job.status) &&
    !job.publications.some(
      (p) =>
        p.attemptCount > 0 ||
        ["published", "sending", "uncertain"].includes(p.state),
    )
  );
}
function replacingJobIds(
  jobs: (Parameters<typeof replaceable>[0] & {
    id: string;
    scheduledFor: Date;
  })[],
  campaignId: string | undefined,
  dates: readonly Date[],
) {
  const times = new Set(dates.map((date) => date.getTime()));
  return campaignId
    ? jobs
        .filter(
          (job) =>
            replaceable(job, campaignId) &&
            times.has(job.scheduledFor.getTime()),
        )
        .map((job) => job.id)
    : [];
}
function availableAutomatic(job: {
  campaignId: string | null;
  status: string;
  plan: unknown;
  publications: { attemptCount: number; state: string }[];
}) {
  return (
    !job.campaignId &&
    JSON.stringify(job.plan) === "{}" &&
    ["queued", "skipped"].includes(job.status) &&
    !job.publications.some(
      (p) =>
        p.attemptCount > 0 ||
        ["published", "sending", "uncertain"].includes(p.state),
    )
  );
}
function yieldsToCampaign(
  job: Parameters<typeof availableAutomatic>[0] & { scheduledFor: Date },
  brief: Pick<CampaignBrief, "startDate" | "endDate">,
) {
  return (
    availableAutomatic(job) &&
    jakartaDate(job.scheduledFor) >= brief.startDate &&
    jakartaDate(job.scheduledFor) <= brief.endDate
  );
}
async function jobWindow(
  brief: Pick<CampaignBrief, "startDate" | "endDate">,
  config: MarketingConfig,
) {
  return prisma.marketingJob.findMany({
    where: {
      OR: [
        {
          scheduledFor: {
            gte: new Date(
              Date.parse(brief.startDate + "T00:00:00+07:00") -
                Math.max(config.cooldownDays, 90) * 86400000,
            ),
            lte: new Date(
              Date.parse(brief.endDate + "T23:59:59+07:00") +
                config.cooldownDays * 86400000,
            ),
          },
        },
        {
          publications: {
            some: {
              state: "published",
              publishedAt: {
                gte: new Date(
                  Date.parse(brief.startDate + "T00:00:00+07:00") -
                    Math.max(config.cooldownDays, 90) * 86400000,
                ),
              },
            },
          },
        },
      ],
    },
    include: { publications: true },
  });
}
type Reservation = {
  assetKey: string | null;
  scheduledFor: Date;
  status: string;
  publications: { state: string; publishedAt: Date | null }[];
};
export function reservedAt(
  jobs: Reservation[],
  when: Date,
  cooldown: number,
  selected: CampaignSlot[] = [],
) {
  const window = cooldown * 86400000;
  const within = (date: Date | string) =>
    Math.abs(new Date(date).getTime() - when.getTime()) <= window;
  return new Set([
    ...jobs
      .filter(
        (job) =>
          job.assetKey &&
          ((["queued", "paused", "preparing", "publishing", "review"].includes(
            job.status,
          ) &&
            within(job.scheduledFor)) ||
            job.publications.some(
              (p) =>
                (["sending", "uncertain"].includes(p.state) &&
                  within(job.scheduledFor)) ||
                (p.state === "published" &&
                  p.publishedAt &&
                  within(p.publishedAt)),
            )),
      )
      .map((job) => job.assetKey!),
    ...selected
      .filter((slot) => within(slot.scheduledFor))
      .map((slot) => slot.asset.assetKey),
  ]);
}
async function inventory(config: MarketingConfig, query = "", refresh = false) {
  return withInvestorRead(async (reader) => {
    const items: InvestorListing[] = [];
    let offset = 0;
    while (true) {
      const batch = await getMarketingInvestorCandidates(
        reader,
        { ...investorFilters(config), query },
        new Set(),
        offset,
        100,
        () => true,
        refresh && offset === 0,
      );
      items.push(...batch.items);
      offset += batch.items.length;
      if (!batch.items.length || offset >= batch.total) break;
    }
    return items;
  });
}
async function campaignRecord(
  row: Awaited<ReturnType<typeof requireCampaign>>,
): Promise<CampaignRecord> {
  const [planned, published] = await Promise.all([
    prisma.marketingJob.count({
      where: {
        campaignId: row.id,
        assetKey: { not: null },
        OR: [{ reason: null }, { reason: { not: "CAMPAIGN_REPLACED" } }],
      },
    }),
    prisma.marketingJob.count({
      where: {
        campaignId: row.id,
        publications: { some: { state: "published" } },
      },
    }),
  ]);
  return {
    id: row.id,
    revision: row.revision,
    state: row.state,
    brief: storedCampaignBrief(row.brief),
    activeBrief: storedCampaignBriefSchema.safeParse(row.activeBrief).success
      ? storedCampaignBriefSchema.parse(row.activeBrief)
      : null,
    planned,
    published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
async function campaignListPage(
  requestedPage: number,
  where: Prisma.MarketingCampaignWhereInput = {},
) {
  const total = await prisma.marketingCampaign.count({ where });
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / 20)));
  const rows = await prisma.marketingCampaign.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 20,
  });
  return {
    items: await Promise.all(rows.map(campaignRecord)),
    total,
    page,
    pageSize: 20,
  };
}
export async function listCampaigns(page = 1) {
  return campaignListPage(page);
}
/** Filter before pagination; an approved period remains authoritative after edits. */
export async function listCampaignGroups(
  currentPage = 1,
  endedPage = 1,
  now = new Date(),
) {
  const today = jakartaDate(now);
  const where = (ended: boolean): Prisma.MarketingCampaignWhereInput => {
    const endDate = ended ? { lt: today } : { gte: today };
    return {
      OR: [
        {
          AND: [
            {
              OR: [
                { state: "draft" },
                { activeBrief: { path: ["endDate"], equals: Prisma.AnyNull } },
              ],
            },
            { brief: { path: ["endDate"], ...endDate } },
          ],
        },
        {
          state: { not: "draft" },
          activeBrief: { path: ["endDate"], ...endDate },
        },
      ],
    };
  };
  const [current, ended] = await Promise.all([
    campaignListPage(currentPage, where(false)),
    campaignListPage(endedPage, where(true)),
  ]);
  return { current, ended };
}
function readProposal(raw: unknown): CampaignProposal {
  const data = raw as CampaignProposal;
  return {
    batch: data.batch,
    policyVersion: data.policyVersion || 0,
    coverage: data.coverage,
    slots: data.slots.map(({ id, scheduledFor, asset, reason }) => ({
      id,
      scheduledFor,
      asset,
      reason,
    })),
    unfilled: data.unfilled || [],
    stock: data.stock,
    capacity: data.capacity,
    target: data.target,
    settingsRevision: data.settingsRevision,
    generatedAt: data.generatedAt,
    briefKey: data.briefKey,
  };
}
export async function getCampaign(id: string): Promise<CampaignDetail> {
  const row = await requireCampaign(id);
  const [proposal, jobs, jobsTotal] = await Promise.all([
    prisma.marketingCampaignProposal.findFirst({
      where: { campaignId: id },
      orderBy: { version: "desc" },
    }),
    prisma.marketingJob.findMany({
      where: { campaignId: id },
      orderBy: { scheduledFor: "desc" },
      take: 100,
      include: publicationInclude,
    }),
    prisma.marketingJob.count({ where: { campaignId: id } }),
  ]);
  return {
    campaign: await campaignRecord(row),
    proposal: proposal
      ? {
          id: proposal.id,
          version: proposal.version,
          approvedAt: proposal.approvedAt?.toISOString() || null,
          data: readProposal(proposal.data),
        }
      : null,
    jobsTotal,
    jobs: jobs.map((j) => ({
      id: j.id,
      scheduledFor: j.scheduledFor.toISOString(),
      status: j.status,
      reason: j.reason,
      address: (j.snapshot as { address?: string }).address || "",
      publications: j.publications.map((p) => ({
        id: p.id,
        channel: p.channel,
        state: p.state,
        errorCode: p.errorCode,
        metrics:
          (p.metrics[0]?.values as Record<string, number | null>) || null,
      })),
    })),
  };
}
export async function saveCampaign(input: {
  id?: string;
  revision?: number;
  brief: CampaignBrief;
}) {
  const brief = campaignBriefSchema.parse(input.brief);
  assertPeriod(brief);
  if (!input.id)
    return getCampaign(
      (await prisma.marketingCampaign.create({ data: { brief: json(brief) } }))
        .id,
    );
  return lease(async () => {
    await requireCampaign(input.id!, input.revision);
    if (!input.revision) throw new MarketingError("CAMPAIGN_CONFLICT", 409);
    const changed = await prisma.marketingCampaign.updateMany({
      where: { id: input.id, revision: input.revision },
      data: { brief: json(brief), revision: { increment: 1 } },
    });
    if (!changed.count) throw new MarketingError("CAMPAIGN_CONFLICT", 409);
    return getCampaign(input.id!);
  });
}
export async function campaignInventory(
  input: CampaignInventoryInput,
  now = new Date(),
): Promise<CampaignInventory> {
  input = campaignInventorySchema.parse(input);
  const { config: global } = await getSettings(),
    config = campaignConfig(global, input.criteria);
  const dates = campaignPreparationDates(input, now);
  const earliest =
    dates[0] ||
    new Date(
      Math.max(now.getTime(), Date.parse(input.startDate + "T00:00:00+07:00")),
    );
  const [source, jobs, scope] = await Promise.all([
    // Reuse the bounded 60s source cache while typing or paging. Deadlines and
    // reservations are still evaluated now; approval verifies each chosen source.
    inventory(config, "", false),
    jobWindow(input, config),
    withInvestorRead((reader) =>
      getMarketingInvestorScope(reader, {
        ...investorFilters(config),
        dataState: "all",
      }),
    ),
  ]);
  const [publishedKeys, reservedKeys] = await Promise.all([
    marketedAssetKeys(source.map(snapshotAsset)),
    reservedAssetKeys(
      source.map(snapshotAsset),
      replacingJobIds(jobs, input.campaignId, dates),
    ),
  ]);
  const qualified = source.filter(
    (item) =>
      eligibleAsset(item, config, earliest) &&
      campaignAssetAvailable(snapshotAsset(item), earliest),
  );
  const unmarketed = qualified.filter(
    (item) => !publishedKeys.has(assetIdentity(item)),
  );
  const all = unmarketed.filter(
    (item) => !reservedKeys.has(assetIdentity(item)),
  );
  const assets = freshAssetOrder(all.map(snapshotAsset));
  const blockers = jobs.filter(
    (job) =>
      !(input.campaignId && replaceable(job, input.campaignId)) &&
      !yieldsToCampaign(job, input),
  );
  const projection = selectCampaignAssets(
    assets,
    dates,
    config.cooldownDays,
    (when) => reservedAt(blockers, when, config.cooldownDays),
    (when) => blockers.some((j) => j.scheduledFor.getTime() === when.getTime()),
    "fresh",
    campaignExposureHistory(blockers, now),
    { ...input, noRepeat: true },
  );
  const recommended = [
    ...new Map(
      projection.flatMap((slot) =>
        slot.asset ? [[slot.asset.assetKey, slot.asset] as const] : [],
      ),
    ).values(),
  ];
  const query = input.query.toLocaleLowerCase("id-ID").trim();
  const matches = assets.filter(
    (item) =>
      !query ||
      [item.id, item.title, item.address, item.city]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(query),
  );
  return {
    items: matches.slice(input.offset, input.offset + 20),
    total: matches.length,
    diagnostics: diagnoseCampaignInventory(
      scope,
      config,
      assets.length,
      earliest,
      qualified.length - unmarketed.length,
      unmarketed.length - all.length,
    ),
    nextOffset:
      input.offset + Math.min(20, Math.max(0, matches.length - input.offset)),
    selected: input.listingIds.map((id) => ({
      id,
      asset: assets.find((item) => item.id === id) || null,
    })),
    recommendation: {
      assets: recommended,
      coverage: {
        eligible: new Set(assets.map((asset) => asset.assetKey)).size,
        scheduled: recommended.length,
        remaining: Math.max(
          0,
          new Set(assets.map((asset) => asset.assetKey)).size -
            recommended.length,
        ),
      },
      filled: projection.filter((slot) => slot.asset).length,
      target: dates.length,
      expiring: source.filter(
        (item) =>
          item.listingCategory === "LELANG" &&
          eligibleAsset(item, config, new Date(0)) &&
          Date.parse(item.auctionDate || "") > earliest.getTime() &&
          !campaignAssetAvailable(snapshotAsset(item), earliest),
      ).length,
      checkedAt: now.toISOString(),
    },
  };
}
type QueueOptions = {
  queue?: boolean;
  automatic?: boolean;
  leased?: boolean;
  now?: Date;
};
export async function generateCampaign(
  id: string,
  revision: number,
  options: QueueOptions = {},
) {
  const now = options.now || new Date();
  const run = async () => {
    const row = await requireCampaign(id, revision);
    let brief = campaignBriefSchema.parse(
      storedCampaignBrief(options.automatic ? row.activeBrief : row.brief),
    );
    assertPeriod(brief, now);
    const { config: global } = await getSettings(),
      config = campaignConfig(global, brief);
    if (brief.channels.some((c) => !config[c]))
      throw new MarketingError("CHANNEL_DISABLED");
    const [all, jobs, previous] = await Promise.all([
      inventory(config, "", options.queue === true),
      jobWindow(brief, config),
      prisma.marketingCampaignProposal.findFirst({
        where: { campaignId: id },
        orderBy: { version: "desc" },
      }),
    ]);
    const datesInWindow = options.queue
      ? campaignPreparationDates(brief, now)
      : campaignSchedule(brief, now);
    const [protectedKeys, reservedKeys] = await Promise.all([
      marketedAssetKeys(all.map(snapshotAsset)),
      reservedAssetKeys(
        all.map(snapshotAsset),
        replacingJobIds(jobs, id, datesInWindow),
      ),
    ]);
    const retainedKeys = new Set<string>();
    const retained = options.automatic
      ? [...jobs]
          .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
          .filter((job) => {
            const asset =
              job.snapshot as unknown as import("./domain").AssetSnapshot;
            const item = all.find(
              (item) => assetIdentity(item) === job.assetKey,
            );
            const keep =
              job.campaignId === id &&
              job.assetKey &&
              !retainedKeys.has(job.assetKey) &&
              datesInWindow.some(
                (date) => date.getTime() === job.scheduledFor.getTime(),
              ) &&
              ["queued", "paused", "preparing", "publishing"].includes(
                job.status,
              ) &&
              !protectedKeys.has(job.assetKey) &&
              !reservedKeys.has(job.assetKey) &&
              item &&
              eligibleAsset(item, config, job.scheduledFor) &&
              campaignAssetAvailable(snapshotAsset(item), job.scheduledFor) &&
              sameCampaignAsset(snapshotAsset(item), asset);
            if (keep) retainedKeys.add(job.assetKey!);
            return keep;
          })
      : [];
    const dates = datesInWindow.filter(
      (date) =>
        !retained.some((job) => job.scheduledFor.getTime() === date.getTime()),
    );
    const blockers = jobs.filter(
      (j) => !replaceable(j, id) && !yieldsToCampaign(j, brief),
    );
    const allowed = all.filter(
      (item) =>
        !protectedKeys.has(assetIdentity(item)) &&
        !reservedKeys.has(assetIdentity(item)) &&
        !retainedKeys.has(assetIdentity(item)),
    );
    // Live queues always re-read saved filters; IDs from an old batch never pin future stock.
    if (options.queue) brief = { ...brief, listingIds: [] };
    if (!brief.listingIds.length) {
      if (brief.assetOrder === "manual")
        throw new MarketingError("CAMPAIGN_SELECT_ASSETS");
      const projection = selectCampaignAssets(
        allowed
          .filter((item) => eligibleAsset(item, config, dates[0] || now))
          .map(snapshotAsset),
        dates,
        config.cooldownDays,
        (when) => reservedAt(blockers, when, config.cooldownDays),
        (when) =>
          blockers.some((job) => job.scheduledFor.getTime() === when.getTime()),
        "fresh",
        campaignExposureHistory(blockers, now),
        { ...brief, noRepeat: true },
      );
      brief = {
        ...brief,
        listingIds: [
          ...new Set(
            projection.flatMap((slot) => (slot.asset ? [slot.asset.id] : [])),
          ),
        ],
      };
    }
    const listings = brief.listingIds.flatMap((id) =>
      allowed.find((i) => i.id === id)
        ? [allowed.find((i) => i.id === id)!]
        : [],
    );
    const byTime = new Map(jobs.map((j) => [j.scheduledFor.toISOString(), j]));
    const slots: CampaignSlot[] = [],
      unfilled: CampaignProposal["unfilled"] = [];
    const projection = selectCampaignAssets(
      listings
        .filter((item) => eligibleAsset(item, config, dates[0] || now))
        .map(snapshotAsset),
      dates,
      config.cooldownDays,
      (when) => reservedAt(blockers, when, config.cooldownDays),
      (when) => {
        const existing = byTime.get(when.toISOString());
        return (
          !!existing &&
          !replaceable(existing, id) &&
          !availableAutomatic(existing)
        );
      },
      brief.assetOrder,
      campaignExposureHistory(blockers, now),
      { ...brief, noRepeat: true },
    );
    for (const { when, asset, reason } of projection) {
      const slot = {
        id: randomUUID(),
        scheduledFor: when.toISOString(),
        reason,
      };
      if (asset) slots.push({ ...slot, asset });
      else unfilled.push(slot);
    }
    const eligibleCount = new Set(
      (brief.assetOrder === "fresh" ? allowed : listings)
        .filter(
          (item) =>
            eligibleAsset(item, config, dates[0] || new Date()) &&
            campaignAssetAvailable(snapshotAsset(item), dates[0] || new Date()),
        )
        .map(assetIdentity),
    ).size;
    const data: CampaignProposal = {
      ...(options.queue ? { batch: campaignBatch(brief, now)! } : {}),
      policyVersion: CAMPAIGN_POLICY_VERSION,
      coverage: {
        eligible: eligibleCount,
        scheduled: new Set(slots.map((slot) => slot.asset.assetKey)).size,
        remaining: Math.max(
          0,
          eligibleCount -
            new Set(slots.map((slot) => slot.asset.assetKey)).size,
        ),
      },
      slots,
      unfilled,
      stock: new Set(
        listings
          .filter(
            (i) =>
              eligibleAsset(i, config, dates[0] || new Date()) &&
              campaignAssetAvailable(snapshotAsset(i), dates[0] || new Date()),
          )
          .map(assetIdentity),
      ).size,
      capacity:
        dates.length -
        unfilled.filter((s) => s.reason === "CAMPAIGN_SLOT_CONFLICT").length,
      target: dates.length,
      settingsRevision: global.revision,
      generatedAt: new Date().toISOString(),
      briefKey: JSON.stringify(
        options.automatic ? storedCampaignBrief(row.activeBrief) : brief,
      ),
    };
    await assertWorkerLease();
    await prisma.$transaction(async (tx) => {
      const changed = await tx.marketingCampaign.updateMany({
        where: { id, revision },
        data: {
          ...(options.automatic ? {} : { brief: json(brief) }),
          revision: { increment: 1 },
        },
      });
      if (!changed.count) throw new MarketingError("CAMPAIGN_CONFLICT", 409);
      await tx.marketingCampaignProposal.create({
        data: {
          campaignId: id,
          version: (previous?.version || 0) + 1,
          data: json(data),
        },
      });
    });
  };
  if (options.leased) await run();
  else await lease(run);
  return getCampaign(id);
}
export const editCampaignSlotSchema = z
  .object({
    slotId: z.string().uuid(),
    listingId: z.string().regex(/^[1-9]\d{0,19}$/),
    scheduledFor: z.string().datetime({ offset: true }),
  })
  .strict();
function assertSlotTime(brief: CampaignBrief, when: string) {
  if (!campaignSchedule(brief).some((d) => d.getTime() === Date.parse(when)))
    throw new MarketingError("INVALID_PLANNING_SLOT");
}
export async function campaignCandidates(
  id: string,
  proposalId: string,
  slotId: string,
  when: string,
  query: string,
  offset: number,
) {
  const detail = await getCampaign(id);
  if (detail.proposal?.id !== proposalId || detail.proposal.approvedAt)
    throw new MarketingError("CAMPAIGN_CONFLICT", 409);
  const brief = detail.campaign.brief;
  assertSlotTime(brief, when);
  const { config: global } = await getSettings(),
    config = campaignConfig(global, brief);
  const [listings, jobs] = await Promise.all([
    inventory(config, query, false),
    jobWindow(brief, config),
  ]);
  const reserved = reservedAt(
    jobs.filter((j) => !replaceable(j, id) && !yieldsToCampaign(j, brief)),
    new Date(when),
    config.cooldownDays,
    detail.proposal.data.slots.filter((s) => s.id !== slotId),
  );
  const [publishedKeys, reservedKeys] = await Promise.all([
    marketedAssetKeys(listings.map(snapshotAsset)),
    reservedAssetKeys(
      listings.map(snapshotAsset),
      replacingJobIds(
        jobs,
        id,
        [...detail.proposal.data.slots, ...detail.proposal.data.unfilled].map(
          (slot) => new Date(slot.scheduledFor),
        ),
      ),
    ),
  ]);
  const items = listings.filter(
    (i) =>
      brief.listingIds.includes(i.id) &&
      eligibleAsset(i, config, new Date(when)) &&
      campaignAssetAvailable(snapshotAsset(i), new Date(when)) &&
      !reserved.has(assetIdentity(i)) &&
      !publishedKeys.has(assetIdentity(i)) &&
      !reservedKeys.has(assetIdentity(i)) &&
      snapshotAsset(i).images.length,
  );
  return {
    items: items
      .slice(offset, offset + 20)
      .map((i) => ({ ...snapshotAsset(i), unavailableReason: null })),
    total: items.length,
    nextOffset: offset + Math.min(20, Math.max(0, items.length - offset)),
  };
}
async function validateSlots(
  id: string,
  brief: CampaignBrief,
  slots: CampaignSlot[],
  config: MarketingConfig,
  replacingTimes = slots.map((slot) => slot.scheduledFor),
) {
  const [jobs, listings] = await Promise.all([
      jobWindow(brief, config),
      inventory(config),
    ]),
    blockers = jobs.filter(
      (j) => !replaceable(j, id) && !yieldsToCampaign(j, brief),
    ),
    selected: CampaignSlot[] = [];
  const [published, reserved] = await Promise.all([
    marketedAssetKeys(slots.map((slot) => slot.asset)),
    reservedAssetKeys(
      slots.map((slot) => slot.asset),
      replacingJobIds(
        jobs,
        id,
        replacingTimes.map((time) => new Date(time)),
      ),
    ),
  ]);
  for (const slot of [...slots].sort((a, b) =>
    a.scheduledFor.localeCompare(b.scheduledFor),
  )) {
    assertSlotTime(brief, slot.scheduledFor);
    const when = new Date(slot.scheduledFor),
      existing = jobs.find((j) => j.scheduledFor.getTime() === when.getTime());
    if (
      (existing &&
        !replaceable(existing, id) &&
        !availableAutomatic(existing)) ||
      selected.some((s) => Date.parse(s.scheduledFor) === when.getTime())
    )
      throw new MarketingError("CAMPAIGN_SLOT_CONFLICT", 409);
    const item = listings.find((i) => i.id === slot.asset.id);
    if (
      !brief.listingIds.includes(slot.asset.id) ||
      published.has(slot.asset.assetKey) ||
      reserved.has(slot.asset.assetKey) ||
      selected.some((item) => item.asset.assetKey === slot.asset.assetKey) ||
      !item ||
      !eligibleAsset(item, config, when) ||
      !campaignAssetAvailable(snapshotAsset(item), when) ||
      reservedAt(blockers, when, config.cooldownDays, selected).has(
        assetIdentity(item),
      ) ||
      !sameCampaignAsset(snapshotAsset(item), slot.asset) ||
      !(await sourceStillMatches(slot.asset))
    )
      throw new MarketingError("CAMPAIGN_REVIEW_REQUIRED", 409);
    selected.push(slot);
  }
  return jobs;
}
export async function editCampaignSlot(
  id: string,
  revision: number,
  proposalId: string,
  input: z.infer<typeof editCampaignSlotSchema>,
) {
  return lease(async () => {
    const detail = await getCampaign(id);
    if (
      detail.campaign.revision !== revision ||
      detail.proposal?.id !== proposalId ||
      detail.proposal.approvedAt ||
      detail.proposal.data.briefKey !== JSON.stringify(detail.campaign.brief)
    )
      throw new MarketingError("CAMPAIGN_CONFLICT", 409);
    const data = detail.proposal.data,
      old = [...data.slots, ...data.unfilled].find(
        (s) => s.id === input.slotId,
      );
    if (!old) throw new MarketingError("CAMPAIGN_NOT_FOUND", 404);
    const { config: global } = await getSettings(),
      config = campaignConfig(global, detail.campaign.brief);
    const item = (await inventory(config, input.listingId)).find(
      (i) => i.id === input.listingId,
    );
    if (!item) throw new MarketingError("CAMPAIGN_REVIEW_REQUIRED", 409);
    const replacement: CampaignSlot = {
      id: old.id,
      asset: snapshotAsset(item),
      scheduledFor: new Date(input.scheduledFor).toISOString(),
      reason: "Aset dipilih manual untuk jadwal ini",
    };
    const slots = [
      ...data.slots.filter((s) => s.id !== old.id),
      replacement,
    ].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    await validateSlots(
      id,
      detail.campaign.brief,
      slots,
      config,
      [...slots, ...data.unfilled].map((slot) => slot.scheduledFor),
    );
    // A moved slot leaves its original campaign time empty; it cannot add another post to a full time.
    const moved =
      Date.parse(input.scheduledFor) !== Date.parse(old.scheduledFor);
    const unfilled = data.unfilled.filter(
      (g) =>
        g.id !== old.id &&
        Date.parse(g.scheduledFor) !== Date.parse(input.scheduledFor),
    );
    if (moved)
      unfilled.push({
        id: randomUUID(),
        scheduledFor: old.scheduledFor,
        reason: "CAMPAIGN_NO_ELIGIBLE_ASSET",
      });
    await prisma.$transaction(async (tx) => {
      const changed = await tx.marketingCampaign.updateMany({
        where: { id, revision },
        data: { revision: { increment: 1 } },
      });
      if (!changed.count) throw new MarketingError("CAMPAIGN_CONFLICT", 409);
      await tx.marketingCampaignProposal.update({
        where: { id: proposalId },
        data: {
          data: json({
            ...data,
            slots,
            unfilled,
            settingsRevision: global.revision,
          }),
        },
      });
    });
    return getCampaign(id);
  });
}
export async function approveCampaign(
  id: string,
  revision: number,
  proposalId: string,
  options: QueueOptions = {},
) {
  const now = options.now || new Date();
  const run = async () => {
    const detail = await getCampaign(id);
    if (detail.proposal?.id !== proposalId)
      throw new MarketingError("CAMPAIGN_CONFLICT", 409);
    if (detail.proposal.approvedAt) return detail;
    if (detail.campaign.revision !== revision)
      throw new MarketingError("CAMPAIGN_CONFLICT", 409);
    const brief = campaignBriefSchema.parse(
        options.automatic ? detail.campaign.activeBrief : detail.campaign.brief,
      ),
      data = detail.proposal.data,
      paused = detail.campaign.state === "paused";
    assertPeriod(brief, now);
    const { config: global } = await getSettings(),
      config = campaignConfig(global, brief);
    if (
      data.briefKey !== JSON.stringify(brief) ||
      data.settingsRevision !== global.revision
    )
      throw new MarketingError("CAMPAIGN_CONFLICT", 409);
    if (data.policyVersion !== CAMPAIGN_POLICY_VERSION)
      throw new MarketingError("CAMPAIGN_POLICY_CHANGED", 409);
    if (
      !data.slots.length &&
      !(data.batch && (data.unfilled.length || options.automatic))
    )
      throw new MarketingError("CAMPAIGN_NO_SLOTS");
    if (brief.channels.some((c) => !config[c]))
      throw new MarketingError("CHANNEL_DISABLED");
    const validationBrief = options.automatic
      ? { ...brief, listingIds: data.slots.map((slot) => slot.asset.id) }
      : brief;
    const jobs = await validateSlots(
      id,
      validationBrief,
      data.slots,
      config,
      [...data.slots, ...data.unfilled].map((slot) => slot.scheduledFor),
    );
    await assertWorkerLease();
    await prisma.$transaction(
      async (tx) => {
        const metadata = data.batch
          ? await tx.marketingCampaign.findUniqueOrThrow({
              where: { id },
              select: { evaluation: true },
            })
          : null;
        const changed = await tx.marketingCampaign.updateMany({
          where: { id, revision },
          data: {
            state: paused ? "paused" : "running",
            activeBrief: json(brief),
            ...(data.batch
              ? {
                  evaluation: json({
                    ...(metadata?.evaluation &&
                    typeof metadata.evaluation === "object" &&
                    !Array.isArray(metadata.evaluation)
                      ? metadata.evaluation
                      : {}),
                    queue: {
                      ...data.batch,
                      checkedAt: now.toISOString(),
                      policyVersion: CAMPAIGN_POLICY_VERSION,
                      retryAt: data.unfilled.some(
                        (slot) => slot.reason !== "CAMPAIGN_SLOT_CONFLICT",
                      )
                        ? new Date(now.getTime() + 15 * 60000).toISOString()
                        : null,
                    },
                  }),
                }
              : {}),
            revision: { increment: 1 },
          },
        });
        if (!changed.count) throw new MarketingError("CAMPAIGN_CONFLICT", 409);
        const old = (
          await tx.marketingJob.findMany({
            where: { campaignId: id, scheduledFor: { gt: new Date() } },
            include: { publications: true },
          })
        ).filter(
          (j) =>
            replaceable(j, id) &&
            (!options.automatic ||
              [...data.slots, ...data.unfilled].some(
                (slot) =>
                  Date.parse(slot.scheduledFor) === j.scheduledFor.getTime(),
              ) ||
              (data.batch && jakartaDate(j.scheduledFor) > data.batch.endDate)),
        );
        if (old.length) {
          await tx.marketingPublication.deleteMany({
            where: { jobId: { in: old.map((j) => j.id) }, attemptCount: 0 },
          });
          await tx.marketingJob.updateMany({
            where: { id: { in: old.map((j) => j.id) } },
            data: { status: "skipped", reason: "CAMPAIGN_REPLACED" },
          });
        }
        // Regular automatic posting yields to the explicit campaign schedule. Manual plans and attempts survive.
        await tx.marketingJob.updateMany({
          where: {
            campaignId: null,
            plan: { equals: {} },
            status: "queued",
            scheduledFor: {
              gte: new Date(
                Math.max(
                  Date.now(),
                  Date.parse(brief.startDate + "T00:00:00+07:00"),
                ),
              ),
              lte: new Date(brief.endDate + "T23:59:59+07:00"),
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
        for (const slot of [...data.slots, ...data.unfilled]) {
          const asset = "asset" in slot ? (slot as CampaignSlot).asset : null,
            existing = jobs.find(
              (j) => j.scheduledFor.toISOString() === slot.scheduledFor,
            );
          if (
            existing &&
            !replaceable(existing, id) &&
            !availableAutomatic(existing)
          ) {
            if (asset) throw new MarketingError("CAMPAIGN_SLOT_CONFLICT", 409);
            continue;
          }
          if (existing && availableAutomatic(existing))
            await tx.marketingPublication.deleteMany({
              where: { jobId: existing.id, attemptCount: 0 },
            });
          const plan = {
            kind: "campaign",
            campaignId: id,
            proposalId,
            campaignName: brief.name,
            selectionReason: asset ? slot.reason : undefined,
            listingId: asset?.id || null,
            channels: brief.channels,
            criteria: campaignCriteria(brief),
          };
          const patch = {
            status: asset ? (paused ? "paused" : "queued") : "skipped",
            reason: asset
              ? paused
                ? "CAMPAIGN_PAUSED"
                : null
              : "CAMPAIGN_NO_ELIGIBLE_ASSET",
            campaignId: id,
            campaignProposalId: proposalId,
            listingId: null,
            assetKey: asset?.assetKey || null,
            snapshot: json(asset || {}),
            caption: asset ? campaignCaption(asset, config) : "",
            media: json([]),
            plan: json(plan),
            settingsRevision: global.revision,
          };
          await tx.marketingJob.upsert({
            where: { scheduledFor: new Date(slot.scheduledFor) },
            create: {
              id: slot.id,
              scheduledFor: new Date(slot.scheduledFor),
              ...patch,
            },
            update: patch,
          });
        }
        await tx.marketingCampaignProposal.update({
          where: { id: proposalId },
          data: { approvedAt: new Date() },
        });
      },
      { maxWait: 10000, timeout: 60000 },
    );
    return getCampaign(id);
  };
  return options.leased ? run() : lease(run);
}
/** Runs inside the worker lease; never publishes or enables automation. */
export async function refreshCampaignQueues(
  now = new Date(),
  onlyId?: string,
  force = false,
) {
  const rows = await prisma.marketingCampaign.findMany({
    where: {
      ...(onlyId ? { id: onlyId } : {}),
      state: { in: ["running", "paused"] },
      activeBrief: { path: ["endDate"], gte: jakartaDate(now) },
    },
    orderBy: { createdAt: "asc" },
  });
  let changed = false;
  for (const row of rows) {
    const parsed = campaignBriefSchema.safeParse(row.activeBrief);
    if (!parsed.success) continue;
    const batch = campaignBatch(parsed.data, now),
      previous = campaignQueueState(row.evaluation);
    if (!batch) continue;
    const repairDue =
      previous &&
      Date.parse(previous.checkedAt) <= now.getTime() - 15 * 60000 &&
      (await prisma.marketingJob.count({
        where: {
          campaignId: row.id,
          status: "review",
          scheduledFor: {
            gt: now,
            lte: new Date(batch.endDate + "T23:59:59.999+07:00"),
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
      }));
    const due =
      force ||
      repairDue ||
      !previous ||
      previous.policyVersion !== CAMPAIGN_POLICY_VERSION ||
      previous.startDate !== batch.startDate ||
      (!!previous.retryAt && Date.parse(previous.retryAt) <= now.getTime());
    if (!due) continue;
    await assertWorkerLease();
    const options = { queue: true, automatic: true, leased: true, now };
    const generated = await generateCampaign(row.id, row.revision, options);
    if (!generated.proposal) throw new MarketingError("CAMPAIGN_CONFLICT", 409);
    await approveCampaign(
      row.id,
      generated.campaign.revision,
      generated.proposal.id,
      options,
    );
    changed = true;
  }
  return changed;
}
export async function refreshCampaignQueue(id: string, force = false) {
  await requireCampaign(id);
  try {
    await lease(() => refreshCampaignQueues(new Date(), id, force));
  } catch (error) {
    // The existing worker will finish the same queue; the next read observes it.
    if (!(error instanceof MarketingError) || error.code !== "WORKER_BUSY")
      throw error;
  }
  return getCampaignQueue(id);
}

/** The panel and Planner read the same persisted job, snapshot and publication evidence. */
export async function getCampaignQueue(
  id: string,
  now = new Date(),
): Promise<CampaignQueue> {
  const row = await requireCampaign(id);
  const active = row.state === "running" || row.state === "paused";
  const brief = storedCampaignBrief(active ? row.activeBrief : row.brief);
  const batch = campaignBatch(brief, now),
    queue = campaignQueueState(row.evaluation);
  const jobs =
    batch && active
      ? await prisma.marketingJob.findMany({
          where: {
            campaignId: id,
            scheduledFor: {
              gte: new Date(batch.startDate + "T00:00:00+07:00"),
              lte: new Date(batch.endDate + "T23:59:59.999+07:00"),
            },
            OR: [{ reason: null }, { reason: { not: "CAMPAIGN_REPLACED" } }],
          },
          orderBy: { scheduledFor: "asc" },
          include: { publications: true },
        })
      : [];
  const days: CampaignQueue["days"] = [];
  if (batch)
    for (
      let day = batch.startDate;
      day <= batch.endDate;
      day = campaignDayAfter(day, 1)
    ) {
      days.push({
        date: day,
        slots: brief.schedules.map((time) => {
          const scheduledFor = new Date(
            day + "T" + time + ":00+07:00",
          ).toISOString();
          const job = jobs.find(
            (job) => job.scheduledFor.toISOString() === scheduledFor,
          );
          const snapshot = job?.snapshot as AssetSnapshot | undefined;
          return {
            scheduledFor,
            asset: snapshot?.id ? snapshot : null,
            status: job?.publications.some((p) => p.state === "published")
              ? "published"
              : job?.status || (active ? "unfilled" : "draft"),
            reason: job?.reason || null,
          };
        }),
      });
    }
  // Drafts have no jobs yet. Check the saved filters before explaining an empty
  // queue; absence of an assignment is not evidence of absent source stock.
  let inventory: CampaignQueue["inventory"] = null;
  let inventoryError = false;
  if (
    batch &&
    (!active ||
      days.some((day) =>
        day.slots.some(
          (slot) =>
            !slot.asset && Date.parse(slot.scheduledFor) > now.getTime(),
        ),
      ))
  ) {
    try {
      const stock = await campaignInventory(
        {
          criteria: campaignCriteria(brief),
          startDate: brief.startDate,
          endDate: brief.endDate,
          schedules: brief.schedules,
          campaignId: id,
          listingIds: [],
          query: "",
          offset: 0,
        },
        now,
      );
      inventory = {
        diagnostics: stock.diagnostics,
        eligible: stock.total,
        upcomingSlots: stock.recommendation?.target || 0,
        checkedAt: stock.recommendation?.checkedAt || now.toISOString(),
      };
    } catch (error) {
      // A failed source read must not hide the persisted Planner assignments.
      inventoryError = true;
      console.error(
        "[Campaign queue inventory]",
        error instanceof Error ? error.name : "UnknownError",
      );
    }
  }
  return {
    campaignId: id,
    campaignName: brief.name,
    revision: row.revision,
    active,
    batch,
    checkedAt: inventory?.checkedAt || queue?.checkedAt || null,
    inventory,
    inventoryError,
    days,
  };
}

export async function setCampaignPaused(
  id: string,
  revision: number,
  paused: boolean,
) {
  return lease(async () => {
    const row = await requireCampaign(id, revision);
    const applied = storedCampaignBriefSchema.safeParse(row.activeBrief);
    if (row.state !== "draft" && !applied.success)
      throw new MarketingError("CAMPAIGN_REVIEW_REQUIRED");
    if (applied.success && campaignPeriodEnded(applied.data))
      throw new MarketingError("CAMPAIGN_ENDED");
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const changed = await tx.marketingCampaign.updateMany({
        where: { id, revision, state: { not: "draft" } },
        data: {
          state: paused ? "paused" : "running",
          revision: { increment: 1 },
        },
      });
      if (!changed.count) throw new MarketingError("CAMPAIGN_CONFLICT", 409);
      if (!paused)
        await tx.marketingJob.updateMany({
          where: {
            campaignId: id,
            status: "paused",
            scheduledFor: { lte: now },
          },
          data: { status: "skipped", reason: "MISSED_SLOT" },
        });
      await tx.marketingJob.updateMany({
        where: {
          campaignId: id,
          status: paused ? "queued" : "paused",
          scheduledFor: { gt: now },
          publications: { none: { attemptCount: { gt: 0 } } },
        },
        data: {
          status: paused ? "paused" : "queued",
          reason: paused ? "CAMPAIGN_PAUSED" : null,
        },
      });
    });
    return getCampaign(id);
  });
}
export async function previewCampaignSlot(
  id: string,
  revision: number,
  proposalId: string,
  slotId: string,
) {
  const detail = await getCampaign(id);
  if (
    detail.campaign.revision !== revision ||
    detail.proposal?.id !== proposalId
  )
    throw new MarketingError("CAMPAIGN_CONFLICT", 409);
  const slot = detail.proposal.data.slots.find((s) => s.id === slotId);
  if (!slot) throw new MarketingError("CAMPAIGN_NOT_FOUND", 404);
  assertPeriod(detail.campaign.brief);
  assertSlotTime(detail.campaign.brief, slot.scheduledFor);
  if (!(await sourceStillMatches(slot.asset)))
    throw new MarketingError("CAMPAIGN_REVIEW_REQUIRED", 409);
  const { config } = await getSettings();
  return {
    id: slot.id,
    media: await buildMarketingMedia(slot.id, slot.asset, config),
    caption: campaignCaption(slot.asset, config),
  };
}
