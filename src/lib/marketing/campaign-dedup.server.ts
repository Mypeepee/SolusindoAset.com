import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AssetSnapshot } from "./domain";

const reservationStatuses = [
  "queued",
  "paused",
  "preparing",
  "publishing",
  "review",
];

/** Match stable parcels and legacy IDs, including plans not yet rendered. */
async function matchingAssetKeys(
  assets: AssetSnapshot[],
  where: Prisma.MarketingJobWhereInput,
  exceptJobIds: readonly string[],
) {
  const result = new Set<string>();
  // Bound JSON predicates even when inventory spans an entire municipality.
  for (let offset = 0; offset < assets.length; offset += 100) {
    const batch = assets.slice(offset, offset + 100);
    const ids = [...new Set(batch.map((asset) => asset.id))];
    const keys = [...new Set(batch.map((asset) => asset.assetKey))];
    const jobs = await prisma.marketingJob.findMany({
      where: {
        ...where,
        ...(exceptJobIds.length ? { id: { notIn: [...exceptJobIds] } } : {}),
        OR: [
          { assetKey: { in: keys } },
          { listingId: { in: ids } },
          ...ids.flatMap((id) => [
            { snapshot: { path: ["id"], equals: id } },
            { plan: { path: ["listingId"], equals: id } },
          ]),
          ...keys.map((key) => ({
            snapshot: { path: ["assetKey"], equals: key },
          })),
        ],
      },
      select: {
        id: true,
        assetKey: true,
        listingId: true,
        snapshot: true,
        plan: true,
      },
    });
    const matchingIds = new Set<string>();
    const matchingKeys = new Set<string>();
    for (const job of jobs) {
      if (exceptJobIds.includes(job.id)) continue;
      const snapshot = job.snapshot as Partial<AssetSnapshot> | null;
      const plan = job.plan as { listingId?: string } | null;
      for (const id of [job.listingId, snapshot?.id, plan?.listingId])
        if (id) matchingIds.add(String(id));
      for (const key of [job.assetKey, snapshot?.assetKey])
        if (key) matchingKeys.add(key);
    }
    for (const asset of batch)
      if (matchingIds.has(asset.id) || matchingKeys.has(asset.assetKey))
        result.add(asset.assetKey);
  }
  return result;
}

/** Lifetime publication evidence, including ambiguous sends; never a rolling cooldown. */
export async function marketedAssetKeys(
  assets: AssetSnapshot[],
  exceptJobId?: string,
) {
  return matchingAssetKeys(
    assets,
    {
      publications: {
        some: {
          OR: [
            { state: { in: ["published", "sending", "uncertain"] } },
            { publishedAt: { not: null } },
          ],
        },
      },
    },
    exceptJobId ? [exceptJobId] : [],
  );
}

/** Committed assignments remain reserved across batches, pauses and day rollover. */
export async function reservedAssetKeys(
  assets: AssetSnapshot[],
  exceptJobIds: readonly string[] = [],
  before?: Date,
) {
  return matchingAssetKeys(
    assets,
    {
      status: { in: reservationStatuses },
      ...(before ? { scheduledFor: { lt: before } } : {}),
    },
    exceptJobIds,
  );
}
