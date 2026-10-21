import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { newPropertyRecommendations, validRecommendationRequest } from "@/lib/chatbot/new-property-recommendations";
import { readChatbotBody } from "@/lib/chatbot/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: NextRequest) {
  const secret = process.env.CHATBOT_CLIENT_TOKEN;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503, headers });
  const a = Buffer.from(secret), b = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new TypeError("INVALID_REQUEST");
    const input = await readChatbotBody(request, 8000);
    if (!validRecommendationRequest(input)) throw new TypeError("INVALID_REQUEST");
    return NextResponse.json(await newPropertyRecommendations(prisma, input, secret), { headers });
  } catch (error) {
    const invalid = error instanceof TypeError || error instanceof SyntaxError;
    return NextResponse.json({ error: error instanceof RangeError ? "TOO_LARGE" : invalid ? "INVALID_REQUEST" : "RECOMMENDATIONS_UNAVAILABLE" },
      { status: error instanceof RangeError ? 413 : invalid ? 400 : 503, headers });
  }
}
