import { NextRequest, NextResponse } from "next/server";
import { inspectPendingInstagramConnection } from "@/lib/marketing/instagram-diagnostics.server";
import { retryPendingInstagramConnection } from "@/lib/marketing/instagram.server";
import { pendingInstagramStatus } from "@/lib/marketing/instagram-pending.server";
import {
  apiFailure,
  MarketingError,
  privateHeaders,
  readJson,
  requireMarketingOwner,
} from "@/lib/marketing/security.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    await requireMarketingOwner();
    return NextResponse.json(pendingInstagramStatus(), {
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
    if (input?.action === "inspect")
      return NextResponse.json(await inspectPendingInstagramConnection(), {
        headers: privateHeaders,
      });
    if (input?.action === "retry") {
      await retryPendingInstagramConnection();
      return NextResponse.json(
        { connected: true },
        { headers: privateHeaders },
      );
    }
    throw new MarketingError("INVALID_REQUEST");
  } catch (error) {
    return apiFailure(error);
  }
}
