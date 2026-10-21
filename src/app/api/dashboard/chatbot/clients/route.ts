import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { clientBackendStatus, clientProbe } from "@/lib/chatbot/client-status";
import { isSameOriginRequest } from "@/lib/chatbot/request-origin";
import { CHATBOT_HEADERS as headers, chatbotError as fail, readChatbotBody, resolveChatbotAgent } from "@/lib/chatbot/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    const where = { id_agent: access.agentId, chatbot_nomor_whatsapp: { not: null } };
    const [service, crm] = await Promise.allSettled([
      fetch(`${access.base}/agents/${access.agentId}/admin/client-capture`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${access.token}` } }).then(async (r) => r.ok ? clientBackendStatus(await r.json()) : null),
      prisma.$transaction([prisma.klien.count({ where }), prisma.klien.findFirst({ where, orderBy: { chatbot_terakhir_pada: "desc" },
        select: { id_klien: true, nama: true, chatbot_nomor_whatsapp: true, chatbot_terakhir_pada: true } })]),
    ]);
    const result = crm.status === "fulfilled" ? crm.value : null;
    const last = result?.[1];
    const phone = last?.chatbot_nomor_whatsapp;
    return NextResponse.json({ backend: service.status === "fulfilled" ? service.value : null,
      crm: { available: !!result, count: result ? result[0] : null,
        last: last?.chatbot_terakhir_pada ? { id: last.id_klien, name: last.nama,
          phone_masked: phone ? `+${phone.slice(0, 4)}••••${phone.slice(-4)}` : "—", saved_at: last.chatbot_terakhir_pada.toISOString() } : null },
      can_open_crm: access.ownerId === access.agentId }, { headers });
  } catch { return fail("SERVICE_UNAVAILABLE", 503); }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return fail("FORBIDDEN", 403);
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_REQUEST", 400);
    const input = await readChatbotBody(request, 1024);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) return fail("INVALID_REQUEST", 400);
    const response = await fetch(`${access.base}/agents/${access.agentId}/admin/client-capture/check`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" }, body: "{}",
    });
    if (!response.ok) return fail(response.status === 429 ? "CLIENT_CHECK_RATE_LIMIT" : "CLIENT_CHECK_UNAVAILABLE", response.status === 429 ? 429 : 503);
    const probe = clientProbe(await response.json());
    return probe ? NextResponse.json({ probe }, { headers }) : fail("CLIENT_CHECK_UNAVAILABLE", 503);
  } catch (error) { return fail(error instanceof RangeError ? "TOO_LARGE" : error instanceof SyntaxError ? "INVALID_REQUEST" : "CLIENT_CHECK_UNAVAILABLE",
    error instanceof RangeError ? 413 : error instanceof SyntaxError ? 400 : 503); }
}
