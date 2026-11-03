import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  instagramActionSchema,
  instagramCursor,
  instagramId,
} from "@/lib/marketing/instagram-content";
import {
  instagramContentAction,
  instagramDetail,
  instagramLibrary,
  instagramMediaComments,
} from "@/lib/marketing/instagram-content.server";
import {
  apiFailure,
  privateHeaders,
  readJson,
  requireMarketingOwner,
} from "@/lib/marketing/security.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
function failure(error: unknown) {
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: "INVALID_REQUEST" },
      { status: 400, headers: privateHeaders },
    );
  if ((error as { meta?: { code?: string } })?.meta?.code === "42P01")
    return NextResponse.json(
      { error: "SCHEMA_NOT_READY" },
      { status: 503, headers: privateHeaders },
    );
  return apiFailure(error);
}
export async function GET(request: NextRequest) {
  try {
    await requireMarketingOwner();
    const params = request.nextUrl.searchParams;
    const mode = z
      .enum(["media", "stories", "detail", "comments", "replies"])
      .parse(params.get("mode") || "media");
    const after = instagramCursor.parse(params.get("after") || undefined);
    let result: unknown;
    if (mode === "media" || mode === "stories")
      result = await instagramLibrary(mode, after);
    else {
      const mediaId = instagramId.parse(params.get("mediaId"));
      result =
        mode === "detail"
          ? await instagramDetail(mediaId)
          : await instagramMediaComments(
              mediaId,
              after,
              mode === "replies"
                ? instagramId.parse(params.get("commentId"))
                : undefined,
            );
    }
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const owner = await requireMarketingOwner(request, true);
    const input = instagramActionSchema.parse(await readJson(request, 16384));
    return NextResponse.json(
      await instagramContentAction(input, owner.ownerId!),
      { headers: privateHeaders },
    );
  } catch (error) {
    return failure(error);
  }
}
