import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkClientDatabase } from "@/lib/chatbot/client-diagnostics";
import { readChatbotBody } from "@/lib/chatbot/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: NextRequest) {
  const secret = process.env.CHATBOT_CLIENT_TOKEN;
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || secret.length < 32) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503, headers });
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    const input = await readChatbotBody(request, 1024);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    return NextResponse.json(await checkClientDatabase(prisma), { headers });
  } catch (error) {
    const status = error instanceof RangeError ? 413 : error instanceof SyntaxError ? 400 : 503;
    return NextResponse.json({ error: status < 500 ? "INVALID_REQUEST" : "CLIENT_DATABASE_UNAVAILABLE" }, { status, headers });
  }
}
