"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Conversation = { contact: string; is_bot_active: boolean; updated_at: number;
  reason?: string | null; resume_at?: number | null; pending_reply?: boolean; blocked_reason?: string | null;
  reply_state?: string; delivery_error?: string | null };
type ConversationData = { items: Conversation[]; total: number; attention: number; manual_pause_seconds?: number; server_now?: number; bot_control_phone?: string };
const endpoint = "/api/dashboard/chatbot/conversations";

export function useConversations() {
  const [data, setData] = useState<ConversationData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const mounted = useRef(false);
  const fetching = useRef(false);
  const mutating = useRef(false);
  const revision = useRef(0);
  const pollSequence = useRef(0);
  const controllers = useRef(new Set<AbortController>());

  const request = useCallback(async (body?: object) => {
    const controller = new AbortController();
    controllers.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, { method: body ? "PATCH" : "GET", cache: "no-store",
        signal: controller.signal, headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error === "BOT_CONTACT_EXCLUDED" ? "Nomor ini digunakan untuk operasional dan tidak menerima balasan bot." : response.status === 409 ? "Percakapan sedang diproses. Coba sebentar lagi." : "Percakapan belum dapat diperbarui. Silakan coba lagi.");
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
      controllers.current.delete(controller);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (fetching.current || mutating.current || document.hidden) return;
    fetching.current = true;
    const sequence = ++pollSequence.current;
    const version = revision.current;
    setRefreshing(true);
    try {
      const next = await request();
      if (!Array.isArray(next.items) || !Number.isSafeInteger(next.total) || !Number.isSafeInteger(next.attention)) throw new Error();
      if (mounted.current && version === revision.current) { setData(next); setError(""); }
    } catch {
      if (mounted.current && version === revision.current) setError("Status percakapan belum dapat dimuat. Coba perbarui.");
    } finally {
      if (sequence === pollSequence.current) {
        fetching.current = false;
        if (mounted.current) { setLoading(false); setRefreshing(false); }
      }
    }
  }, [request]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const visible = () => { if (!document.hidden) void refresh(); };
    const interval = setInterval(visible, 5000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      revision.current += 1; pollSequence.current += 1; fetching.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      controllers.current.forEach((controller) => controller.abort());
    };
  }, [refresh]);

  const toggle = useCallback(async (row: Conversation) => {
    if (mutating.current) return;
    mutating.current = true;
    revision.current += 1;
    setBusy(row.contact); setError("");
    try {
      await request({ contact: row.contact, is_bot_active: !row.is_bot_active });
      const next = await request();
      if (mounted.current) setData(next);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Status bot belum dapat diubah.");
    } finally {
      mutating.current = false;
      if (mounted.current) setBusy(null);
    }
  }, [request]);

  return { data, error, loading, refreshing, busy, refresh, toggle };
}

export type ConversationsController = ReturnType<typeof useConversations>;
