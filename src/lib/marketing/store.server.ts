import "server-only";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { DEFAULT_CONFIG, settingsSchema, type MarketingConfig } from "./domain";
import { MarketingError } from "./security.server";

export async function getSettings() {
  const row = await prisma.marketingSettings.upsert({
    where: { id: "company" },
    create: { id: "company", config: DEFAULT_CONFIG },
    update: {},
  });
  const parsed = settingsSchema.safeParse({
    ...DEFAULT_CONFIG,
    ...(row.config as object),
    enabled: row.enabled,
    revision: row.revision,
  });
  if (!parsed.success) throw new MarketingError("INVALID_STORED_SETTINGS", 503);
  return { row, config: parsed.data };
}
export async function saveSettings(config: MarketingConfig) {
  const changed = await prisma.marketingSettings.updateMany({
    where: { id: "company", revision: config.revision },
    data: {
      config: config as Prisma.InputJsonValue,
      enabled: config.enabled,
      revision: { increment: 1 },
    },
  });
  if (!changed.count) throw new MarketingError("SETTINGS_CONFLICT", 409);
  // Changes cancel only untouched future slots. Already attempted publications retain evidence.
  await prisma.marketingJob.deleteMany({
    where: {
      status: "queued",
      plan: { equals: {} },
      scheduledFor: { gt: new Date() },
      publications: { none: { attemptCount: { gt: 0 } } },
    },
  });
  return (await getSettings()).config;
}
export async function listJobs(page = 1, pageSize = 20) {
  const where = { OR: [{ reason: null }, { reason: { not: "RESCHEDULED" } }] };
  const [total, items] = await Promise.all([
    prisma.marketingJob.count({ where }),
    prisma.marketingJob.findMany({
      where,
      orderBy: { scheduledFor: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        publications: {
          include: { metrics: { orderBy: { fetchedAt: "desc" }, take: 1 } },
        },
      },
    }),
  ]);
  return { total, page, pageSize, items };
}
export async function recentAssetKeys(
  cooldownDays: number,
  now: Date,
  excludeJobId?: string,
) {
  const since = new Date(now.getTime() - cooldownDays * 86400000);
  const until = new Date(now.getTime() + cooldownDays * 86400000);
  const rows = await prisma.marketingJob.findMany({
    where: {
      assetKey: { not: null },
      ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
      OR: [
        {
          scheduledFor: { gte: since, lte: until },
          OR: [
            { status: { in: ["preparing", "publishing", "review"] } },
            { status: { in: ["queued", "paused"] } },
            {
              publications: {
                some: { state: { in: ["sending", "uncertain"] } },
              },
            },
          ],
        },
        {
          // Cooldown starts at actual publication, including a delayed send.
          publications: {
            some: {
              state: "published",
              publishedAt: { gte: since, lte: until },
            },
          },
        },
      ],
    },
    select: { assetKey: true },
  });
  return new Set(rows.flatMap((row) => (row.assetKey ? [row.assetKey] : [])));
}
export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}
