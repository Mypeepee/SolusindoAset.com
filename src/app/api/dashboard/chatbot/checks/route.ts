import { NextRequest, NextResponse } from "next/server";
import { assetCheckQueue } from "@/lib/chatbot/asset-checks";
import { CHATBOT_HEADERS as headers, chatbotError as fail, readChatbotBody, resolveChatbotAgent } from "@/lib/chatbot/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    const response = await fetch(`${access.base}/agents/${access.agentId}/admin/asset-checks`, { cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${access.token}` } });
    if (!response.ok) return fail("SERVICE_UNAVAILABLE", 503);
    const queue = assetCheckQueue(await response.json());
    return queue ? NextResponse.json(queue, { headers }) : fail("SERVICE_UNAVAILABLE", 503);
  } catch { return fail("SERVICE_UNAVAILABLE", 503); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") return fail("FORBIDDEN", 403);
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_REQUEST", 400);
    const input = await readChatbotBody(request, 1024);
    if (!input || typeof input.id !== "string" || !/^[a-f0-9-]{36}$/i.test(input.id) || input.status !== "completed" ||
      Object.keys(input).some((key) => !["id", "status", "result", "reference"].includes(key)) ||
      input.result != null && (!["available", "sold"].includes(input.result) || typeof input.reference !== "string" || !input.reference.trim() || input.reference.length > 300) ||
      input.result == null && input.reference != null) return fail("INVALID_REQUEST", 400);
    const response = await fetch(`${access.base}/agents/${access.agentId}/admin/asset-checks/${encodeURIComponent(input.id)}`, {
      method: "PATCH", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", ...(input.result ? { result: input.result, reference: input.reference.trim() } : {}) }),
    });
    if (!response.ok) return fail(response.status === 404 ? "ASSET_CHECK_NOT_FOUND" : "SERVICE_UNAVAILABLE", response.status === 404 ? 404 : 503);
    return NextResponse.json({ id: input.id, status: "completed" }, { headers });
  } catch (error) { return fail(error instanceof RangeError ? "TOO_LARGE" : error instanceof SyntaxError ? "INVALID_REQUEST" : "SERVICE_UNAVAILABLE", error instanceof RangeError ? 413 : error instanceof SyntaxError ? 400 : 503); }
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") return fail("FORBIDDEN", 403);
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_REQUEST", 400);
    const input = await readChatbotBody(request, 1024);
    if (!input || typeof input.id !== "string" || !/^[a-f0-9-]{36}$/i.test(input.id) || Object.keys(input).some((key) => key !== "id")) return fail("INVALID_REQUEST", 400);
    const response = await fetch(`${access.base}/agents/${access.agentId}/admin/asset-checks/${encodeURIComponent(input.id)}/retry`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" }, body: "{}",
    });
    if (!response.ok) return fail(response.status === 409 ? "NOTIFICATION_NOT_RETRYABLE" : "SERVICE_UNAVAILABLE", response.status === 409 ? 409 : 503);
    return NextResponse.json({ id: input.id, status: "pending" }, { headers });
  } catch (error) { return fail(error instanceof RangeError ? "TOO_LARGE" : error instanceof SyntaxError ? "INVALID_REQUEST" : "SERVICE_UNAVAILABLE", error instanceof RangeError ? 413 : error instanceof SyntaxError ? 400 : 503); }
}
