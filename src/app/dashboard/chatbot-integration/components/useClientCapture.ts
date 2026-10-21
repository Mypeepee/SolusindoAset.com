"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientCaptureStatus, clientProbe, type ClientCaptureStatus } from "@/lib/chatbot/client-status";

const endpoint = "/api/dashboard/chatbot/clients";

export function useClientCapture() {
  const [data, setData] = useState<ClientCaptureStatus | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [checking, setChecking] = useState(false), [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(false), mutating = useRef(false), revision = useRef(0);
  const activeRead = useRef<AbortController | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const refresh = useCallback(async () => {
    if (activeRead.current || mutating.current || document.hidden) return;
    setRefreshing(true);
    const version = revision.current, controller = new AbortController(); controllers.current.add(controller);
    activeRead.current = controller;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error();
      const status = clientCaptureStatus(await response.json()); if (!status) throw new Error();
      if (mounted.current && version === revision.current) { setData(status); setError(""); }
    } catch { if (mounted.current && version === revision.current) setError("Status penyimpanan belum dapat diperbarui. Silakan coba lagi."); }
    finally { controllers.current.delete(controller); if (activeRead.current === controller) activeRead.current = null;
      if (mounted.current && version === revision.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; revision.current += 1; activeRead.current = null;
      clearInterval(timer); document.removeEventListener("visibilitychange", visible); for (const c of controllers.current) c.abort(); };
  }, [refresh]);
  const runCheck = async () => {
    if (mutating.current) return;
    mutating.current = true; revision.current += 1; activeRead.current?.abort(); activeRead.current = null;
    setRefreshing(false); setChecking(true); setError("");
    const controller = new AbortController(); controllers.current.add(controller);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]) });
      if (!response.ok) throw new Error(response.status === 429 ? "RATE_LIMIT" : "CHECK_FAILED");
      const probe = clientProbe((await response.json()).probe); if (!probe) throw new Error("CHECK_FAILED");
      if (mounted.current) setData((current) => current?.backend ? { ...current, backend: { ...current.backend, probe } } : current);
      mutating.current = false; await refresh();
    } catch (e) { if (mounted.current) setError(e instanceof Error && e.message === "RATE_LIMIT" ? "Tunggu 30 detik sebelum mengulang pemeriksaan." : "Pemeriksaan belum selesai. Silakan coba lagi sebentar."); }
    finally { controllers.current.delete(controller); mutating.current = false; if (mounted.current) setChecking(false); }
  };
  return { data, error, loading, checking, refreshing, refresh, runCheck };
}

export type ClientCaptureController = ReturnType<typeof useClientCapture>;
