import { NextRequest, NextResponse } from "next/server";
import { apiFailure, sameSecret } from "@/lib/marketing/security.server";
import { runMarketingTick } from "@/lib/marketing/service.server";
import { webhookStore } from "@/lib/marketing/instagram-webhook-store.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!sameSecret(token, process.env.CRON_SECRET || ""))
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    await webhookStore.prune();
    return NextResponse.json(await runMarketingTick(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiFailure(error);
  }
}
