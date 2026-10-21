"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionAction, ConnectionStatus, PairingData } from "@/lib/chatbot/types";

const endpoint = "/api/dashboard/chatbot/whatsapp";
const messages: Record<string, string> = {
  UNAUTHENTICATED: "Sesi Anda berakhir. Masuk kembali untuk mengelola WhatsApp.",
  FORBIDDEN: "Akun Anda belum memiliki akses ke koneksi ini.",
  NOT_CONFIGURED: "Koneksi untuk akun Anda belum disiapkan. Hubungi pengelola untuk mengaktifkannya.",
  SERVICE_UNAVAILABLE: "Layanan koneksi sedang tidak tersedia. Coba lagi sebentar.",
  PAIRING_RATE_LIMIT: "Tunggu satu menit sebelum meminta kode baru.",
  PAIRING_NOT_READY: "Koneksi sedang disiapkan. Tunggu hingga QR muncul.",
  INVALID_PHONE: "Gunakan nomor WhatsApp dengan kode negara, misalnya 6281234567890.",
  PAIR_AGAIN_REQUIRED: "Sesi sebelumnya berakhir. Pasangkan kembali WhatsApp Anda.",
  CONVERSATION_BUSY: "Ada percakapan yang sedang diproses. Coba kembali sebentar.",
  REQUEST_FAILED: "Permintaan belum berhasil. Silakan coba lagi.",
};

class ConnectionError extends Error {
  constructor(public code: string) { super(messages[code] || messages.REQUEST_FAILED); }
}

export function useWhatsAppConnection(open: boolean) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [pairing, setPairing] = useState<PairingData>({ qr: null, code: null });
  const [error, setError] = useState<ConnectionError | null>(null);
  const [actionError, setActionError] = useState<ConnectionError | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [online, setOnline] = useState(false);
  const mounted = useRef(false);
  const actionLock = useRef(false);
  const pollLock = useRef(false);
  const revision = useRef(0);
  const pollSequence = useRef(0);
  const controllers = useRef(new Set<AbortController>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; revision.current += 1; pollSequence.current += 1; pollLock.current = false;
      controllers.current.forEach((controller) => controller.abort());
    };
  }, []);

  const request = useCallback(async <T,>(suffix = "", body?: object): Promise<T> => {
    const controller = new AbortController();
    controllers.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${endpoint}${suffix}`, {
        method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined, signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new ConnectionError(data.error || "REQUEST_FAILED");
      return data as T;
    } catch (cause) {
      if (cause instanceof ConnectionError) throw cause;
      throw new ConnectionError("SERVICE_UNAVAILABLE");
    } finally { clearTimeout(timer); controllers.current.delete(controller); }
  }, []);

  const refresh = useCallback(async () => {
    if (pollLock.current || actionLock.current || document.hidden) return;
    pollLock.current = true;
    const sequence = ++pollSequence.current;
    const version = revision.current;
    try {
      const next = await request<ConnectionStatus>();
      if (!mounted.current || version !== revision.current) return;
      setStatus(next); setOnline(true);
      // Read QR only while its modal is visible, never on the dashboard background.
      const nextPairing = open && !next.connected && (next.qr_ready || next.pairing_code_ready)
        ? await request<PairingData>("?view=pairing") : { qr: null, code: null };
      if (mounted.current && version === revision.current) { setPairing(nextPairing); setError(null); }
    } catch (cause) {
      if (mounted.current && version === revision.current) { setError(cause as ConnectionError); setOnline(false); setPairing({ qr: null, code: null }); }
    } finally {
      if (sequence === pollSequence.current) { pollLock.current = false; if (mounted.current) setLoading(false); }
    }
  }, [open, request]);

  useEffect(() => {
    if (!open) setPairing({ qr: null, code: null });
    void refresh();
    const timer = setInterval(() => void refresh(), open ? 2000 : 15000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [open, refresh]);

  const act = useCallback(async (action: ConnectionAction, phone?: string) => {
    if (actionLock.current) return false;
    revision.current += 1;
    actionLock.current = true; setWorking(true); setActionError(null);
    try {
      await request("", { action, ...(phone ? { phone } : {}) });
      const next = await request<ConnectionStatus>();
      if (mounted.current) {
        setStatus(next); setOnline(true); setError(null);
        if (action === "disconnect" || action === "pair_again") setPairing({ qr: null, code: null });
      }
      return true;
    } catch (cause) {
      if (mounted.current) setActionError(cause as ConnectionError);
      return false;
    } finally {
      actionLock.current = false;
      if (mounted.current) { setWorking(false); void refresh(); }
    }
  }, [refresh, request]);

  return { status, pairing, error: error || actionError, loading, working, online, refresh, act };
}
