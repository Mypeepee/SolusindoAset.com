import { NextRequest, NextResponse } from "next/server";
import {
  receiveInstagramWebhook,
  verifyInstagramWebhook,
} from "@/lib/marketing/instagram-webhook.server";
import { apiFailure, privateHeaders } from "@/lib/marketing/security.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const challenge = await verifyInstagramWebhook(request.nextUrl);
    return new NextResponse(challenge, {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await receiveInstagramWebhook(request);
    return NextResponse.json({ received: true }, { headers: privateHeaders });
  } catch (error) {
    return apiFailure(error);
  }
}
