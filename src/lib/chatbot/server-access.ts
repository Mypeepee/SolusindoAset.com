import "server-only";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";
import { CHATBOT_AGENT_ID } from "../../../backend/whatsapp/services/client_capture.js";

export const CHATBOT_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export const chatbotError = (error: string, status: number) => NextResponse.json({ error }, { status, headers: CHATBOT_HEADERS });

export async function resolveChatbotOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { status: 401 as const };
  const agent = await prisma.agent.findUnique({ where: { id_pengguna: session.user.id },
    select: { id_agent: true, jabatan: true, status_keanggotaan: true, pengguna: { select: { peran: true, status_akun: true } } } });
  if (!agent || agent.jabatan !== "OWNER" || agent.status_keanggotaan !== "AKTIF" || agent.pengguna.peran !== "AGENT" || agent.pengguna.status_akun !== "AKTIF") return { status: 403 as const };
  return { status: 200 as const, ownerId: agent.id_agent };
}

export async function resolveChatbotAgent() {
  const access = await resolveChatbotOwner();
  if (access.status !== 200) return chatbotError(access.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", access.status);
  const token = process.env.WHATSAPP_BACKEND_TOKEN, base = process.env.WHATSAPP_BACKEND_URL;
  if (!token || !base) return chatbotError("NOT_CONFIGURED", 503);
  try {
    const url = new URL(base);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.search || url.hash) return chatbotError("NOT_CONFIGURED", 503);
    // Owner manages the central integration; capture always belongs to AG108.
    return { token, base: base.replace(/\/$/, ""), agentId: CHATBOT_AGENT_ID, ownerId: access.ownerId };
  } catch { return chatbotError("NOT_CONFIGURED", 503); }
}

export async function readChatbotBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("INVALID_REQUEST");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > limit) { await reader.cancel(); throw new RangeError("TOO_LARGE"); } chunks.push(value); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
