// app/dashboard/hrm/hooks/useAgents.ts
"use client";

import useSWR from "swr";
import { useMemo } from "react";
import toast from "react-hot-toast";
import { Agent, AgentMetrics, AgentStatus } from "../types/agent.types";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Gagal mengambil data");
    return res.json();
  });

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<{ agents: Agent[] }>(
    "/api/dashboard/hrm",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const agents: Agent[] = data?.agents ?? [];

  const metrics = useMemo<AgentMetrics | null>(() => {
    if (!agents.length) return null;

    const active = agents.filter((a) => a.status_keanggotaan === "AKTIF");
    const pending = agents.filter((a) => a.status_keanggotaan === "PENDING");
    const totalClosing = agents.reduce((sum, a) => sum + a.jumlah_closing, 0);
    const totalOmset = agents.reduce((sum, a) => sum + Number(a.total_omset || 0), 0);
    const avgRating = agents.reduce((s, a) => s + Number(a.rating || 0), 0) / agents.length;
    const topPerformer =
      agents.slice().sort((a, b) => b.jumlah_closing - a.jumlah_closing)[0] ?? null;

    return {
      totalAgents: agents.length,
      activeAgents: active.length,
      pendingAgents: pending.length,
      totalClosing,
      totalOmset,
      avgRating,
      growthRate: 12.5,
      topPerformer,
    };
  }, [agents]);

  if (error) {
    toast.error("Gagal memuat data HRM.");
  }

  const updateAgentStatus = async (
    id_agent: string,
    status: AgentStatus
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/HRM/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_agent, status_keanggotaan: status }),
      });
      if (!res.ok) throw new Error("Gagal update status");
      const json = await res.json();
      const updated = json.agent as Agent;

      mutate(
        (prev) =>
          prev
            ? { agents: prev.agents.map((a) => (a.id_agent === updated.id_agent ? updated : a)) }
            : prev,
        false
      );
      toast.success("Status agent diperbarui.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui status agent.");
      return false;
    }
  };

  const updateAgentOffice = async (
    id_agent: string,
    nama_kantor: string
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/HRM/agent-office", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_agent, nama_kantor }),
      });
      if (!res.ok) throw new Error("Gagal update kantor");
      const json = await res.json();
      const updated = json.agent as Agent;

      mutate(
        (prev) =>
          prev
            ? { agents: prev.agents.map((a) => (a.id_agent === updated.id_agent ? updated : a)) }
            : prev,
        false
      );
      toast.success("Nama kantor agent diperbarui.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui nama kantor.");
      return false;
    }
  };

  return {
    agents,
    loading: isLoading,
    metrics,
    updateAgentStatus,
    updateAgentOffice,
    refetch: () => mutate(),
  };
}
