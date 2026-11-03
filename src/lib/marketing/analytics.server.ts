import "server-only";
import prisma from "@/lib/prisma";
import { monthBounds, shiftMonth } from "./planner";
import { analyticsAsset, cleanMetrics, type AnalyticsDataset } from "./analytics";
import type { Channel } from "./domain";

/** Read only: actual publication dates, never planner dates or list pagination. */
export async function marketingAnalytics(month: string): Promise<AnalyticsDataset> {
  const { end } = monthBounds(month);
  const historyStart = shiftMonth(month, -2);
  // shiftMonth may precede the UI's 2000 lower boundary at January/February 2000.
  const start = new Date(historyStart + "-01T00:00:00+07:00");
  const rows = await prisma.marketingPublication.findMany({
    where: { state: "published", publishedAt: { gte: start, lt: end } },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    include: {
      job: { select: { id: true, snapshot: true } },
      metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
    },
  });
  return {
    month, historyStart, fetchedAt: new Date().toISOString(),
    posts: rows.filter((row) => row.channel === "instagram" || row.channel === "whatsapp").map((row) => ({
      id: row.id, jobId: row.job.id, channel: row.channel as Channel,
      publishedAt: row.publishedAt!.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString() || null,
      permalink: row.permalink, errorCode: row.errorCode,
      metricReason: row.metrics[0]?.reason || null,
      asset: analyticsAsset(row.job.snapshot),
      values: cleanMetrics(row.metrics[0]?.values),
    })),
  };
}
