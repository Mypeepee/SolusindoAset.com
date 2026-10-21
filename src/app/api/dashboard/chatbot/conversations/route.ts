import { NextRequest, NextResponse } from "next/server";
import { resolveChatbotAgent } from "@/lib/chatbot/server-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
async function proxy(request: NextRequest, write: boolean) {
  try {
    if (write && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) return fail("FORBIDDEN", 403);
    const target = await resolveChatbotAgent();
    if (target instanceof NextResponse) return target;
    let suffix = "";
    let input;
    if (write) {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_REQUEST", 400);
      const body = await request.text();
      if (body.length > 1024) return fail("INVALID_REQUEST", 413);
      try { input = JSON.parse(body); } catch { return fail("INVALID_REQUEST", 400); }
      if (!input || Object.keys(input).some((key) => !["contact", "is_bot_active"].includes(key)) || typeof input.contact !== "string" || !/^(?:[1-9]\d{7,14}|lid:\d{1,20})$/.test(input.contact) || typeof input.is_bot_active !== "boolean") return fail("INVALID_REQUEST", 400);
      suffix = `/${encodeURIComponent(input.contact)}/bot`;
    }
    const response = await fetch(`${target.base}/agents/${target.agentId}/admin/conversations${suffix}`, { method: write ? "PATCH" : "GET", cache: "no-store", redirect: "error", headers: { Authorization: `Bearer ${target.token}`, "Content-Type": "application/json" }, ...(write ? { body: JSON.stringify({ is_bot_active: input.is_bot_active }) } : {}), signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      const reason = await response.json().catch(() => ({}));
      return fail(reason.error === "BOT_CONTACT_EXCLUDED" ? "BOT_CONTACT_EXCLUDED" : response.status === 409 ? "CONVERSATION_BUSY" : "SERVICE_UNAVAILABLE", response.status === 409 ? 409 : 503);
    }
    const data = await response.json();
    if (write) return NextResponse.json({ ok: true }, { headers });
    const items = (Array.isArray(data.items) ? data.items : []).map((row: any) => ({ contact: row.contact, is_bot_active: row.is_bot_active === true, updated_at: row.updated_at,
      reason: typeof row.reason === "string" ? row.reason.slice(0, 100) : null,
      resume_at: Number.isSafeInteger(row.resume_at) && row.resume_at > 0 ? row.resume_at : null,
      pending_reply: row.pending_reply === true,
      blocked_reason: ["internal_stock_contact", "bot_control_contact", "connected_account"].includes(row.blocked_reason) ? row.blocked_reason : null,
      reply_state: ["excluded", "manual_temporary", "paused", "processing", "delivery_failed", "waiting_connection", "ready"].includes(row.reply_state) ? row.reply_state : undefined,
      delivery_error: typeof row.delivery_error === "string" && /^[A-Z_]{1,60}$/.test(row.delivery_error) ? row.delivery_error : null }));
    return NextResponse.json({ items,
      total: Number.isSafeInteger(data.total) ? data.total : items.length,
      attention: Number.isSafeInteger(data.attention) ? data.attention : items.filter((row: { is_bot_active: boolean }) => !row.is_bot_active).length,
      bot_control_phone: typeof data.bot_control_phone === "string" && /^[1-9]\d{6,14}$/.test(data.bot_control_phone) ? data.bot_control_phone : undefined,
      manual_pause_seconds: Number.isSafeInteger(data.manual_pause_seconds) && data.manual_pause_seconds >= -1 && data.manual_pause_seconds <= 86400 ? data.manual_pause_seconds : undefined,
      server_now: Number.isSafeInteger(data.server_now) ? data.server_now : undefined,
    }, { headers });
  } catch { return fail("SERVICE_UNAVAILABLE", 503); }
}
export const GET = (request: NextRequest) => proxy(request, false);
export const PATCH = (request: NextRequest) => proxy(request, true);
