import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runInvestorOwnerAlerts } from "@/lib/investor-owner-alerts.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: NextRequest) {
  const supplied = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
  const secret = Buffer.from(process.env.CRON_SECRET || "");
  if (!secret.length || supplied.length !== secret.length || !timingSafeEqual(supplied, secret))
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers });
  try {
    const result = await runInvestorOwnerAlerts({ dryRun: request.nextUrl.searchParams.get("dryRun") === "1" });
    return NextResponse.json(result, { status: result.ready && result.configured ? 200 : 503, headers });
  } catch (error) {
    console.error("[investor-owner-alerts]", error instanceof Error ? error.name : "ALERT_FAILED");
    return NextResponse.json({ error: "Notifikasi Investor belum dapat diproses." }, { status: 500, headers });
  }
}
