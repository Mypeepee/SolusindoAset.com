"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentDashboardData } from "../components/agent/types";

type State =
  | { status: "idle" | "loading"; data: AgentDashboardData | null; error: string | null }
  | { status: "ready"; data: AgentDashboardData; error: null }
  | { status: "error"; data: AgentDashboardData | null; error: string };

const ENDPOINT = "/api/dashboard/agent/overview";

export function useAgentDashboard() {
  const [state, setState] = useState<State>({
    status: "idle",
    data: null,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await fetch(ENDPOINT, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || "Gagal memuat dashboard.");

      setState({ status: "ready", data: json.data as AgentDashboardData, error: null });
    } catch (e: any) {
      setState((s) => ({
        status: "error",
        data: s.data,
        error: e?.message || "Terjadi kesalahan.",
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loading = state.status === "idle" || state.status === "loading";
  const data = state.status === "ready" ? state.data : state.data;

  const refresh = useCallback(() => fetchData(), [fetchData]);

  return useMemo(
    () => ({
      loading,
      data,
      error: state.error,
      refresh,
    }),
    [loading, data, state.error, refresh]
  );
}