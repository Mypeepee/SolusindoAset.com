"use client";

import { useSession } from "next-auth/react";
import { AgentDashboardHeader } from "./components/agent/AgentDashboardHeader";
import { AgentQuickActions } from "./components/agent/AgentQuickActions";
import { AgentKpiGrid } from "./components/agent/AgentKpiGrid";
import { AgentPipelineCard } from "./components/agent/AgentPipelineCard";
import { AgentTasksCard } from "./components/agent/AgentTasksCard";
import { AgentLeadsInbox } from "./components/agent/AgentLeadsInbox";
import { AgentListingsCard } from "./components/agent/AgentListingsCard";
import { useAgentDashboard } from "./hooks/useAgentDashboard";
import { Icon } from "@iconify/react";

export default function DashboardAgentPage() {
  const { data: session, status } = useSession();
  const isAgent = (session?.user as any)?.role === "AGENT";

  const { loading, data, error, refresh } = useAgentDashboard();

  // Optional guard UI (middleware server-side tetap disarankan juga)
  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Memuat session...</p>
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="px-5 py-10">
        <div className="max-w-xl mx-auto rounded-3xl border border-white/10 bg-[#07090f] p-6 text-center">
          <Icon icon="solar:shield-warning-bold-duotone" className="text-4xl text-amber-200 mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-white">Akses dibatasi</h2>
          <p className="mt-2 text-sm text-slate-400">
            Dashboard ini khusus untuk akun dengan role <span className="text-white font-semibold">AGENT</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 space-y-6">
      <AgentDashboardHeader userName={session?.user?.name} />

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" className="text-lg" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-2 rounded-xl border border-rose-400/30 bg-black/20 hover:bg-rose-500/10 text-xs text-rose-100 transition"
          >
            Coba lagi
          </button>
        </div>
      ) : null}

      <AgentQuickActions onRefresh={refresh} />

      <AgentKpiGrid loading={loading} kpis={data?.kpis} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <AgentPipelineCard loading={loading} pipeline={data?.pipeline} />
        <AgentTasksCard loading={loading} tasks={data?.tasks} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <AgentLeadsInbox loading={loading} leads={data?.leads} />
        <AgentListingsCard loading={loading} listings={data?.listings} />
      </div>
    </div>
  );
}