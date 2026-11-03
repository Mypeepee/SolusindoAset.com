import "server-only";
import { campaignPlan } from "./campaign";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { withInvestorRead } from "@/lib/investor-read.server";
import { getMarketingInvestorCandidates } from "@/lib/investor-cma-legacy.server";
import {
  eligibleAsset,
  investorFilters,
  snapshotAsset,
  type MarketingConfig,
} from "./domain";
import { canPrepareSlot } from "./planner";
import {
  configurePlanSchema,
  editablePlan,
  manualPlan,
  planCandidateReason,
  type PlanCandidate,
  validPlanTime,
  type ConfigurePlan,
} from "./plan";
import { getSettings, json, recentAssetKeys } from "./store.server";
import { MarketingError } from "./security.server";
import { assertWorkerLease, lease, sourceStillMatches } from "./service.server";
import { marketedAssetKeys, reservedAssetKeys } from "./campaign-dedup.server";

async function candidates(
  config: MarketingConfig,
  when: Date,
  query: string,
  offset: number,
  excludeJobId?: string,
  refresh = false,
) {
  const excluded = await recentAssetKeys(
    config.cooldownDays,
    when,
    excludeJobId,
  );
  return withInvestorRead((reader) =>
    getMarketingInvestorCandidates(
      reader,
      { ...investorFilters(config), query },
      excluded,
      offset,
      20,
      (item) => eligibleAsset(item, config, when),
      refresh,
    ),
  );
}
export async function planCandidates(
  when: string,
  query: string,
  offset: number,
  excludeJobId?: string,
) {
  const date = new Date(when);
  if (!validPlanTime(date)) throw new MarketingError("INVALID_PLANNING_SLOT");
  const { config } = await getSettings();
  const reserved = await recentAssetKeys(
    config.cooldownDays,
    date,
    excludeJobId,
  );
  const batch = await withInvestorRead((reader) =>
    getMarketingInvestorCandidates(
      reader,
      { ...investorFilters(config), dataState: "all", query },
      new Set(),
      offset,
      20,
      () => true,
      false,
      (item) => !planCandidateReason(item, config, date, reserved),
    ),
  );
  const [marketed, assigned] = await Promise.all([
    marketedAssetKeys(batch.items.map(snapshotAsset), excludeJobId),
    reservedAssetKeys(
      batch.items.map(snapshotAsset),
      excludeJobId ? [excludeJobId] : [],
    ),
  ]);
  return {
    items: batch.items.map((item): PlanCandidate => {
      const asset = snapshotAsset(item);
      return {
        ...asset,
        unavailableReason:
          (marketed.has(asset.assetKey) ? "ASSET_ALREADY_MARKETED" : null) ||
          (assigned.has(asset.assetKey) ? "ASSET_COOLDOWN" : null) ||
          planCandidateReason(item, config, date, reserved) ||
          (!asset.images.length ? "PHOTO_UNAVAILABLE" : null),
      };
    }),
    total: batch.total,
    offset,
    nextOffset: offset + batch.items.length,
  };
}
export async function configurePlan(input: ConfigurePlan) {
  input = configurePlanSchema.parse(input);
  return lease(async () => {
    const { config } = await getSettings();
    const scheduledFor = new Date(input.scheduledFor);
    const sourceTime = new Date(input.sourceScheduledFor);
    if (!validPlanTime(scheduledFor))
      throw new MarketingError("INVALID_PLANNING_SLOT");
    if (input.channels.some((channel) => !config[channel]))
      throw new MarketingError("CHANNEL_DISABLED");
    const previous = await prisma.marketingJob.findUnique({
      where: input.jobId ? { id: input.jobId } : { scheduledFor: sourceTime },
      include: { publications: true },
    });
    if (input.jobId && !previous) throw new MarketingError("NOT_FOUND", 404);
    if (campaignPlan(previous) || previous?.campaignId)
      throw new MarketingError("CAMPAIGN_LOCKED", 409);
    if (!editablePlan(previous))
      throw new MarketingError("PLANNING_SLOT_LOCKED", 409);
    if (
      previous &&
      (previous.scheduledFor.getTime() !== sourceTime.getTime() ||
        (input.jobId
          ? previous.updatedAt.getTime() !==
            Date.parse(input.expectedUpdatedAt!)
          : !!previous.listingId || !!manualPlan(previous)))
    )
      throw new MarketingError("PLAN_CONFLICT", 409);
    if (!previous && !canPrepareSlot(config, sourceTime))
      throw new MarketingError("INVALID_PLANNING_SLOT");
    const id = previous?.id || randomUUID();
    const moved = scheduledFor.getTime() !== sourceTime.getTime();
    const target = moved
      ? await prisma.marketingJob.findUnique({
          where: { scheduledFor },
          include: { publications: true },
        })
      : null;
    const ownMarker =
      target?.reason === "RESCHEDULED" &&
      (target.plan as Record<string, unknown> | null)?.replacementId === id;
    if (
      moved &&
      ((target && !ownMarker) ||
        (!ownMarker && canPrepareSlot(config, scheduledFor)))
    )
      throw new MarketingError("PLAN_TIME_CONFLICT", 409);

    let snapshot = null;
    if (input.listingId) {
      const batch = await candidates(
        config,
        scheduledFor,
        input.listingId,
        0,
        previous?.id,
        true,
      );
      const asset = batch.items.find((item) => item.id === input.listingId);
      if (!asset || !eligibleAsset(asset, config, scheduledFor))
        throw new MarketingError("SELECTED_ASSET_UNAVAILABLE");
      snapshot = snapshotAsset(asset);
      const [marketed, reserved] = await Promise.all([
        marketedAssetKeys([snapshot], previous?.id),
        reservedAssetKeys([snapshot], previous ? [previous.id] : []),
      ]);
      if (marketed.has(snapshot.assetKey))
        throw new MarketingError("ASSET_ALREADY_MARKETED");
      if (reserved.has(snapshot.assetKey))
        throw new MarketingError("SELECTED_ASSET_UNAVAILABLE");
      if (!snapshot.images.length || !(await sourceStillMatches(snapshot)))
        throw new MarketingError("SELECTED_ASSET_UNAVAILABLE");
    }
    const patch = {
      scheduledFor,
      status: "queued",
      reason: null,
      listingId: null,
      assetKey: snapshot?.assetKey || null,
      snapshot: json(snapshot || {}),
      caption: "",
      media: json([]),
      settingsRevision: config.revision,
      plan: json({
        kind: "manual",
        listingId: input.listingId,
        channels: input.channels,
      }),
    };
    await assertWorkerLease();
    try {
      return await prisma.$transaction(async (tx) => {
        if (ownMarker)
          await tx.marketingJob.delete({ where: { id: target!.id } });
        if (previous) {
          const changed = await tx.marketingJob.updateMany({
            where: {
              id,
              updatedAt: previous.updatedAt,
              status: previous.status,
              publications: {
                none: {
                  OR: [
                    { attemptCount: { gt: 0 } },
                    { state: { in: ["published", "sending", "uncertain"] } },
                  ],
                },
              },
            },
            data: patch,
          });
          if (!changed.count) throw new MarketingError("PLAN_CONFLICT", 409);
          await tx.marketingPublication.deleteMany({ where: { jobId: id } });
        } else await tx.marketingJob.create({ data: { id, ...patch } });
        if (moved)
          await tx.marketingJob.create({
            data: {
              id: randomUUID(),
              scheduledFor: sourceTime,
              status: "skipped",
              reason: "RESCHEDULED",
              settingsRevision: config.revision,
              plan: json({ replacementId: id }),
            },
          });
        return tx.marketingJob.findUniqueOrThrow({
          where: { id },
          include: {
            publications: {
              include: { metrics: { orderBy: { fetchedAt: "desc" }, take: 1 } },
            },
          },
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new MarketingError("PLAN_TIME_CONFLICT", 409);
      throw error;
    }
  });
}
