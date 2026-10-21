import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readChatbotBody } from "@/lib/chatbot/server-access";
import { chatbotSurvey, validSurveyRequest, SurveyBookingError } from "@/lib/chatbot/survey-booking";
import { pusherServer } from "@/lib/pusher-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: NextRequest) {
  const secret = process.env.CHATBOT_CLIENT_TOKEN;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503, headers });
  const a = Buffer.from(secret), b = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new TypeError();
    const input = await readChatbotBody(request, 4000) as any;
    if (!validSurveyRequest(input)) throw new TypeError();
    const result = await chatbotSurvey(prisma, input);
    if ("booking_id" in result && result.created) void pusherServer.trigger(`survei-agent-${input.agent_id}`, "survei:new", {
      id_booking: result.booking_id, nama_klien: input.name, tanggal_survei: `${input.date}T${input.time}:00+07:00` }).catch(() => {});
    return NextResponse.json(result, { headers });
  } catch (error) {
    const invalid = error instanceof TypeError || error instanceof SyntaxError;
    return NextResponse.json({ error: error instanceof SurveyBookingError ? error.code : error instanceof RangeError ? "TOO_LARGE" : invalid ? "INVALID_REQUEST" : "SURVEY_UNAVAILABLE" },
      { status: error instanceof SurveyBookingError ? error.status : error instanceof RangeError ? 413 : invalid ? 400 : 503, headers });
  }
}
