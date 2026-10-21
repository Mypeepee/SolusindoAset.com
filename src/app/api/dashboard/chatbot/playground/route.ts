import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPropertyKnowledge } from "@/lib/chatbot/property-knowledge";
import { playgroundBackendFailure, playgroundTransportFailure } from "@/lib/chatbot/playground-errors";
import { isPlaygroundResponse } from "@/lib/chatbot/playground";
import { isSameOriginRequest } from "@/lib/chatbot/request-origin";
import { CHATBOT_HEADERS as headers, chatbotError as fail, readChatbotBody, resolveChatbotAgent } from "@/lib/chatbot/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const validRequestId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
function backendFailure(stage: string, failure: { error: string; status: number; retry_after_seconds?: number }) {
  // Only fixed codes/stages; never log authorization, chat contents or raw errors.
  console.warn("[chatbot.playground]", { stage, error: failure.error, status: failure.status });
  return NextResponse.json(failure, { status: failure.status, headers: { ...headers,
    ...(failure.retry_after_seconds ? { "Retry-After": String(failure.retry_after_seconds) } : {}) } });
}

// Only the small context card leaves the server, not the complete AI context.
type ContextProperty = { id: string; name: string; location: string; price_display: string | null;
  price_label: string; transaction_type: string; specifications?: { land_area_m2?: number | null }; nearby?: unknown[] };
function card(asset: ContextProperty | null) {
  if (!asset) return null;
  return { id: asset.id, name: asset.name, location: asset.location, price_display: asset.price_display,
    price_label: asset.price_label, land_area_m2: asset.specifications?.land_area_m2 ?? null,
    nearby_count: Array.isArray(asset.nearby) ? asset.nearby.length : 0, transaction_type: asset.transaction_type };
}

export async function GET() {
  try {
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    const result = await getPropertyKnowledge(prisma, { text: "cari lelang Sidoarjo" });
    const property = result.asset || result.candidates[0] || null;
    return NextResponse.json({ property: card(property), source: result.source }, { headers });
  } catch { return fail("PROPERTY_LOOKUP_UNAVAILABLE", 503); }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return fail("FORBIDDEN", 403);
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_REQUEST", 400);
    const input = await readChatbotBody(request, 48000);
    const history = input?.history;
    if (!Array.isArray(history) || !history.length || history.length > 20 ||
      history.some((m) => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 4000) ||
      history.reduce((n, m) => n + m.content.length, 0) > 24000 || history[history.length - 1].role !== "user" ||
      (input.previousId != null && (typeof input.previousId !== "string" || !/^[1-9]\d{0,17}$/.test(input.previousId))) ||
      (input.requestId != null && !validRequestId(input.requestId)) || (input.conversationId != null && !validRequestId(input.conversationId))) return fail("INVALID_REQUEST", 400);
    let response: Response;
    try {
      response = await fetch(`${access.base}/sandbox/${encodeURIComponent(access.agentId)}/messages`, {
        method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(115000)]),
        headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ history: history.map(({ role, content }) => ({ role, content })), previousId: input.previousId || null,
          conversationId: input.conversationId, requestId: input.requestId || crypto.randomUUID() }),
      });
    } catch (error) {
      return backendFailure("backend_connection", playgroundTransportFailure(error, request.signal.aborted));
    }
    if (!response.ok) {
      return backendFailure("backend_response", playgroundBackendFailure(response.status, await response.json().catch(() => null), response.headers.get("retry-after")));
    }
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object" || Array.isArray(data)) return backendFailure("backend_format", { error: "CHATBOT_BACKEND_INVALID_RESPONSE", status: 503 });
    const result = { reply: data.reply, ...(data.replies !== undefined ? { replies: data.replies } : {}), suppressed: data.suppressed === true, asset: card(data.asset), knowledge: { status: data.knowledge?.status, source: data.knowledge?.source },
      ...(data.session ? { session: { asset_id: data.session.asset_id, is_bot_active: data.session.is_bot_active, idle_timeout_ms: data.session.idle_timeout_ms } } : {}),
      ...(data.attachments !== undefined ? { attachments: Array.isArray(data.attachments) ? data.attachments.map((file: { id: string }) =>
        ({ ...file, url: `/api/dashboard/chatbot/playground/documents/${file.id}` })) : data.attachments } : {}),
      ...(data.document_error !== undefined ? { document_error: data.document_error } : {}),
      generation: { mode: data.generation?.mode || "rules" } };
    if (!isPlaygroundResponse(result)) return backendFailure("backend_format", { error: "CHATBOT_BACKEND_INVALID_RESPONSE", status: 503 });
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (request.signal.aborted) return fail("REQUEST_CANCELLED", 499);
    if (error instanceof Error && error.name === "TimeoutError") return fail("SANDBOX_TIMEOUT", 504);
    return fail(error instanceof RangeError ? "TOO_LARGE" : error instanceof SyntaxError ? "INVALID_REQUEST" : "SERVICE_UNAVAILABLE", error instanceof RangeError ? 413 : error instanceof SyntaxError ? 400 : 503);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return fail("FORBIDDEN", 403);
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_REQUEST", 400);
    const input = await readChatbotBody(request, 1024);
    if (!input || !validRequestId(input.requestId) || Object.keys(input).some((key) => key !== "requestId")) return fail("INVALID_REQUEST", 400);
    const response = await fetch(`${access.base}/sandbox/${access.agentId}/messages/${input.requestId}`, {
      method: "DELETE", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000), headers: { Authorization: `Bearer ${access.token}` },
    });
    return response.ok ? new NextResponse(null, { status: 204, headers }) : fail("SERVICE_UNAVAILABLE", 503);
  } catch (error) { return fail(error instanceof RangeError ? "TOO_LARGE" : error instanceof SyntaxError ? "INVALID_REQUEST" : "SERVICE_UNAVAILABLE", error instanceof RangeError ? 413 : error instanceof SyntaxError ? 400 : 503); }
}
