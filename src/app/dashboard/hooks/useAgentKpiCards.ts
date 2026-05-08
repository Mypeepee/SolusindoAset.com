"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type AgentKpiCardsData = {
  totalPendapatan: number;
  totalTransaksi: number;
  totalListing: number;
  leadBaru: number;
  pendapatanDelta: number | null;
  transaksiBulanIni: number;
  transaksiBulanLalu: number;
};

type State = {
  loading: boolean;
  data: AgentKpiCardsData | null;
  error: string | null;
};

export function useAgentKpiCards() {
  const [state, setState] = useState<State>({ loading: true, data: null, error: null });

  const fetch_ = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res  = await fetch("/api/dashboard/agent/kpi-cards", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.message || "Gagal memuat KPI.");
      setState({ loading: false, data: json.data, error: null });
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message || "Terjadi kesalahan." }));
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return useMemo(() => ({ ...state, refresh: fetch_ }), [state, fetch_]);
}
