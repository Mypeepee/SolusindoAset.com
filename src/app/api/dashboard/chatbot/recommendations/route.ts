import { NextRequest, NextResponse } from "next/server";
import { CHATBOT_HEADERS as headers, chatbotError as fail, readChatbotBody, resolveChatbotAgent } from "@/lib/chatbot/server-access";
import { isSameOriginRequest } from "@/lib/chatbot/request-origin";
import { recommendationStatus, recommendationMutation } from "@/lib/chatbot/recommendation-status";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(request: NextRequest, write: boolean) {
  try {
    if (write && !isSameOriginRequest(request)) return fail("FORBIDDEN", 403);
    const access = await resolveChatbotAgent();
    if (access instanceof NextResponse) return access;
    let body;
    if (write) {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("INVALID_REQUEST", 400);
      const input = recommendationMutation(await readChatbotBody(request, 1024));
      if (!input) return fail("INVALID_REQUEST", 400);
      body = JSON.stringify(input);
    }
    const response = await fetch(`${access.base}/agents/${access.agentId}/admin/recommendations`, { method: write ? "PATCH" : "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" }, ...(body ? { body } : {}) });
    if (!response.ok) return fail("RECOMMENDATIONS_UNAVAILABLE", 503);
    const data = recommendationStatus(await response.json());
    return data ? NextResponse.json(data, { headers }) : fail("RECOMMENDATIONS_UNAVAILABLE", 503);
  } catch (error) { return fail(error instanceof RangeError ? "TOO_LARGE" : error instanceof SyntaxError ? "INVALID_REQUEST" : "RECOMMENDATIONS_UNAVAILABLE", error instanceof RangeError ? 413 : error instanceof SyntaxError ? 400 : 503); }
}
export const GET = (request: NextRequest) => proxy(request, false);
export const PATCH = (request: NextRequest) => proxy(request, true);
