import { NextRequest, NextResponse } from "next/server";
import { resolveChatbotAgent } from "@/lib/chatbot/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
const exposedErrors = new Set(["PAIRING_NOT_READY", "PAIRING_RATE_LIMIT", "INVALID_PHONE", "PAIR_AGAIN_REQUIRED", "CONVERSATION_BUSY", "RESET_NOT_REQUIRED"]);

async function connection() {
  const target = await resolveChatbotAgent();
  if (target instanceof NextResponse) return target;
  return { token: target.token, base: `${target.base}/agents/${target.agentId}/admin/whatsapp` };
}

async function proxy(request: NextRequest, write: boolean) {
  try {
    if (write && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) return fail("FORBIDDEN", 403);
    const target = await connection();
    if (target instanceof NextResponse) return target;
    let path = "status";
    let body: Record<string, unknown> | undefined;
    if (write) {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_REQUEST", 400);
      // Limit the actual body, including requests without Content-Length.
      const reader = request.body?.getReader();
      if (!reader) return fail("INVALID_REQUEST", 400);
      let text = "";
      let size = 0;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); return fail("INVALID_REQUEST", 413); }
        text += decoder.decode(value, { stream: true });
      }
      let input;
      try { input = JSON.parse(text + decoder.decode()); } catch { return fail("INVALID_REQUEST", 400); }
      if (input?.action === "connect") { path = "connect"; body = {}; }
      else if (input?.action === "disconnect") { path = "disconnect"; body = {}; }
      else if (input?.action === "pair_again") { path = "reconnect"; body = { reset: true }; }
      else if (input?.action === "pairing_code") {
        if (typeof input.phone !== "string" || !/^[1-9]\d{7,14}$/.test(input.phone)) return fail("INVALID_PHONE", 400);
        path = "pairing-code"; body = { phone: input.phone };
      } else return fail("INVALID_REQUEST", 400);
    } else if (request.nextUrl.searchParams.get("view") === "pairing") path = "pairing";
    const response = await fetch(`${target.base}/${path}`, {
      method: write ? "POST" : "GET", cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${target.token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      return fail(exposedErrors.has(problem.error) ? problem.error : "SERVICE_UNAVAILABLE", [400, 409, 429].includes(response.status) ? response.status : 503);
    }
    const data = await response.json();
    if (write) return NextResponse.json({ ok: true }, { status: 202, headers });
    if (path === "pairing") return NextResponse.json({ qr: data.qr || null, code: data.code || null }, { headers });
    // Only fields used by the UI leave the server.
    return NextResponse.json({ status: data.status, connected: data.connected === true, phone: data.phone || null,
      bot_accepting: typeof data.bot_accepting === "boolean" ? data.bot_accepting : null,
      qr_ready: data.qr_ready === true, pairing_code_ready: data.pairing_code_ready === true,
      received: data.received || 0, sent: data.sent || 0, handovers: data.handovers || 0,
      last_message_at: data.last_message_at || null }, { headers });
  } catch { return fail("SERVICE_UNAVAILABLE", 503); }
}

export const GET = (request: NextRequest) => proxy(request, false);
export const POST = (request: NextRequest) => proxy(request, true);
