import "server-only";
import prisma from "@/lib/prisma";
import { jakartaDate } from "./domain";
import { storedCampaignBriefSchema, type CampaignPeriod } from "./campaign";
import { campaignQueueState } from "./campaign-batches";

/** Uses the approved period, so editing a draft cannot change live automation. */
export async function activeCampaignPeriods(
  startDate: string,
  endDate: string,
): Promise<CampaignPeriod[]> {
  const rows = await prisma.marketingCampaign.findMany({
    where: {
      state: { in: ["running", "paused"] },
      AND: [
        { activeBrief: { path: ["startDate"], lte: endDate } },
        { activeBrief: { path: ["endDate"], gte: startDate } },
      ],
    },
    select: { id: true, state: true, activeBrief: true, evaluation: true },
  });
  return rows.flatMap((row) => {
    const parsed = storedCampaignBriefSchema.safeParse(row.activeBrief);
    return parsed.success
      ? [
          {
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
            plan: {
              id: row.id,
              name: parsed.data.name,
              schedules: parsed.data.schedules,
              channels: parsed.data.channels,
              preparedThrough: campaignQueueState(row.evaluation)?.endDate,
              state:
                row.state === "paused"
                  ? ("paused" as const)
                  : ("running" as const),
            },
          },
        ]
      : [];
  });
}

/** Draft rhythms are read-only calendar projections, never execution jobs. */
export async function pendingCampaignSummaries(
  startDate: string,
  endDate: string,
) {
  const today = jakartaDate();
  const rows = await prisma.marketingCampaign.findMany({
    where: {
      AND: [
        { brief: { path: ["startDate"], lte: endDate } },
        {
          brief: {
            path: ["endDate"],
            gte: startDate > today ? startDate : today,
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, state: true, brief: true, activeBrief: true },
  });
  return rows.flatMap((row) => {
    const draft = storedCampaignBriefSchema.safeParse(row.brief);
    const applied = storedCampaignBriefSchema.safeParse(row.activeBrief);
    if (!draft.success) return [];
    if (
      row.state !== "draft" &&
      applied.success &&
      JSON.stringify(draft.data) === JSON.stringify(applied.data)
    )
      return [];
    return [
      {
        id: row.id,
        name: draft.data.name,
        assets: draft.data.listingIds.length,
        applied: row.state !== "draft" && applied.success,
        period: {
          startDate: draft.data.startDate,
          endDate: draft.data.endDate,
          plan: {
            id: row.id,
            name: draft.data.name,
            schedules: draft.data.schedules,
            channels: draft.data.channels,
            state: "draft" as const,
          },
        },
      },
    ];
  });
}
