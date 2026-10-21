import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { captureClient, isClientCapture } from "@/lib/chatbot/client-capture";
import { readChatbotBody } from "@/lib/chatbot/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: NextRequest) {
  const secret = process.env.CHATBOT_CLIENT_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!secret || secret.length < 32) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503, headers });
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    const input = await readChatbotBody(request, 12000);
    if (!isClientCapture(input)) return NextResponse.json({ error: "INVALID_CLIENT_CAPTURE" }, { status: 400, headers });
    return NextResponse.json(await captureClient(prisma, input), { headers });
  } catch (error) {
    const malformed = error instanceof SyntaxError || error instanceof TypeError;
    return NextResponse.json({ error: error instanceof RangeError ? "TOO_LARGE" : malformed ? "INVALID_REQUEST" : "CLIENT_CAPTURE_UNAVAILABLE" },
      { status: error instanceof RangeError ? 413 : malformed ? 400 : 503, headers });
  }
}
