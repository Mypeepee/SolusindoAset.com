import { NextRequest, NextResponse } from "next/server";
import {
  instagramWebhookStatus,
  subscribeInstagramWebhook,
} from "@/lib/marketing/instagram-webhook.server";
import {
  apiFailure,
  privateHeaders,
  requireMarketingOwner,
  readJson,
  MarketingError,
} from "@/lib/marketing/security.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireMarketingOwner();
    return NextResponse.json(await instagramWebhookStatus(), {
      headers: privateHeaders,
    });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireMarketingOwner(request, true);
    const input = await readJson(request, 1024);
    if (input?.action !== "subscribe")
      throw new MarketingError("INVALID_REQUEST", 400);
    return NextResponse.json(await subscribeInstagramWebhook(input.fields), {
      headers: privateHeaders,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
