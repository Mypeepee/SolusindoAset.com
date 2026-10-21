import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPropertyKnowledge, isBuyerCriteria } from "@/lib/chatbot/property-knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: NextRequest) {
  const started = performance.now();
  const secret = process.env.CHATBOT_PROPERTY_TOKEN;
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || secret.length < 32) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503, headers });
  const a = Buffer.from(secret), b = Buffer.from(supplied || "");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  try {
    // Bound streamed bodies as well as bodies with Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 20000) { await reader.cancel(); return NextResponse.json({ error: "TOO_LARGE" }, { status: 413, headers }); } chunks.push(value); }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof input?.text !== "string" || input.text.length > 4000 || (input.criteria != null && !isBuyerCriteria(input.criteria)) ||
      (input.previousId != null && (typeof input.previousId !== "string" || !/^[1-9]\d{0,17}$/.test(input.previousId)))) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    }
    const knowledge = await getPropertyKnowledge(prisma, { text: input.text, previousId: input.previousId, criteria: input.criteria || undefined });
    const durationMs = Math.round(performance.now() - started);
    if (durationMs > 3000) console.warn({ event: "chatbot_property_lookup_slow", duration_ms: durationMs });
    return NextResponse.json(knowledge, { headers });
  } catch (error) {
    const malformed = error instanceof SyntaxError;
    // Keep timings and allowlisted error codes, never DB messages/query values.
    if (!malformed) {
      const code = (error as { code?: unknown })?.code;
      console.error({ event: "chatbot_property_lookup_failed", duration_ms: Math.round(performance.now() - started),
        code: typeof code === "string" && /^P\d{4}$/.test(code) ? code : "INTERNAL_ERROR" });
    }
    return NextResponse.json({ error: malformed ? "INVALID_REQUEST" : "PROPERTY_LOOKUP_UNAVAILABLE" }, { status: malformed ? 400 : 503, headers });
  }
}
