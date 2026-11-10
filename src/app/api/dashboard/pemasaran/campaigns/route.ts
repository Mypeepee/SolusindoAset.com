import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  campaignBriefSchema,
  campaignInventorySchema,
} from "@/lib/marketing/campaign";
import {
  approveCampaign,
  campaignCandidates,
  campaignInventory,
  editCampaignSlot,
  editCampaignSlotSchema,
  generateCampaign,
  getCampaign,
  listCampaigns,
  listCampaignGroups,
  previewCampaignSlot,
  saveCampaign,
  setCampaignPaused,
  getCampaignQueue,
  refreshCampaignQueue,
} from "@/lib/marketing/campaigns.server";
import {
  apiFailure,
  privateHeaders,
  readJson,
  requireMarketingOwner,
  MarketingError,
} from "@/lib/marketing/security.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const id = z.string().uuid(),
  revision = z.number().int().positive();
export async function GET(request: NextRequest) {
  try {
    await requireMarketingOwner();
    const p = request.nextUrl.searchParams;
    let result;
    if (p.get("mode") === "queue")
      result = await getCampaignQueue(id.parse(p.get("id")));
    else if (p.get("mode") === "candidates")
      result = await campaignCandidates(
        id.parse(p.get("id")),
        id.parse(p.get("proposal")),
        id.parse(p.get("slot")),
        z.string().datetime({ offset: true }).parse(p.get("when")),
        z
          .string()
          .max(100)
          .parse(p.get("query") || ""),
        z.coerce
          .number()
          .int()
          .min(0)
          .max(100000)
          .parse(p.get("offset") || 0),
      );
    else if (p.get("view") === "grouped") {
      const page = z.coerce.number().int().min(1).max(10000);
      result = await listCampaignGroups(
        page.parse(p.get("page") || 1),
        page.parse(p.get("endedPage") || 1),
      );
    } else
      result = p.has("id")
        ? await getCampaign(id.parse(p.get("id")))
        : await listCampaigns(
            z.coerce
              .number()
              .int()
              .min(1)
              .max(10000)
              .parse(p.get("page") || 1),
          );
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    return failure(error, "GET");
  }
}
export async function POST(request: NextRequest) {
  let action = "parse";
  try {
    await requireMarketingOwner(request, true);
    const input = await readJson(request);
    action = typeof input.action === "string" ? input.action : "unknown";
    let result;
    if (input.action === "inventory")
      result = await campaignInventory(
        campaignInventorySchema.parse(input.inventory),
      );
    else if (input.action === "save")
      result = await saveCampaign({
        id: id.optional().parse(input.id),
        revision: revision.optional().parse(input.revision),
        brief: campaignBriefSchema.parse(input.brief),
      });
    else if (input.action === "refresh-queue")
      result = await refreshCampaignQueue(
        id.parse(input.id),
        input.force === true,
      );
    else {
      const campaignId = id.parse(input.id),
        expected = revision.parse(input.revision);
      switch (input.action) {
        case "generate":
          result = await generateCampaign(campaignId, expected, {
            queue: input.queue === true,
          });
          break;
        case "edit-slot":
          result = await editCampaignSlot(
            campaignId,
            expected,
            id.parse(input.proposalId),
            editCampaignSlotSchema.parse(input.slot),
          );
          break;
        case "approve":
          result = await approveCampaign(
            campaignId,
            expected,
            id.parse(input.proposalId),
            { queue: input.queue === true },
          );
          break;
        case "pause":
          result = await setCampaignPaused(
            campaignId,
            expected,
            z.boolean().parse(input.paused),
          );
          break;
        case "preview":
          result = await previewCampaignSlot(
            campaignId,
            expected,
            id.parse(input.proposalId),
            id.parse(input.slotId),
          );
          break;
        default:
          throw new MarketingError("INVALID_REQUEST");
      }
    }
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    return failure(error, action);
  }
}
function failure(error: unknown, action: string) {
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: "INVALID_SETTINGS", fields: error.flatten().fieldErrors },
      { status: 400, headers: privateHeaders },
    );
  if (!(error instanceof MarketingError)) {
    const detail = error as {
      name?: unknown;
      code?: unknown;
      message?: unknown;
    };
    console.error("[marketing campaigns API] Unexpected failure", {
      action,
      name: typeof detail?.name === "string" ? detail.name : "UnknownError",
      code: typeof detail?.code === "string" ? detail.code : undefined,
      message:
        typeof detail?.message === "string" ? detail.message : "Unknown error",
    });
  }
  return apiFailure(error);
}
