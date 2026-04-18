"use client";

import { useSession } from "next-auth/react";
import { Icon } from "@iconify/react";

import { AgentDashboardHeader }  from "./components/agent/AgentDashboardHeader";
import { AgentPriorityBanner }   from "./components/agent/AgentPriorityBanner";
import { AgentQuickActions }     from "./components/agent/AgentQuickActions";
import { AgentKpiGrid }          from "./components/agent/AgentKpiGrid";
import { AgentPipelineCard }     from "./components/agent/AgentPipelineCard";
import { AgentTodaySchedule }    from "./components/agent/AgentTodaySchedule";
import { AgentTasksCard }        from "./components/agent/AgentTasksCard";
import { AgentLeadsInbox }       from "./components/agent/AgentLeadsInbox";
import { AgentListingsCard }     from "./components/agent/AgentListingsCard";
import { useAgentDashboard }     from "./hooks/useAgentDashboard";

export default function DashboardAgentPage() {
  const { data: session, status } = useSession();
  const isAgent = (session?.user as any)?.role === "AGENT";

  const { loading, data, error, refresh } = useAgentDashboard();

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
        <p className="text-sm text-slate-400">Memuat session…</p>
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="px-5 py-10">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#07090f] p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/10">
            <Icon icon="solar:shield-warning-bold-duotone" className="text-3xl text-amber-200" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-white">Akses Dibatasi</h2>
          <p className="mt-2 text-sm text-slate-400">
            Dashboard ini khusus untuk akun dengan role{" "}
            <span className="font-semibold text-white">AGENT</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-5 py-6">

      {/* ── 1. Hero header ── */}
      <AgentDashboardHeader userName={session?.user?.name} />

      {/* ── 2. Priority / alert strip ── */}
      <AgentPriorityBanner loading={loading} data={data} />

      {/* ── 3. Error banner ── */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/8 p-4 text-sm text-rose-200">
          <div className="flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold-duotone" className="text-lg shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="shrink-0 rounded-xl border border-rose-400/30 bg-black/20 px-3 py-2 text-xs text-rose-100 transition hover:bg-rose-500/10"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* ── 4. Quick actions ── */}
      <AgentQuickActions onRefresh={refresh} />

      {/* ── 5. KPI Grid ── */}
      <AgentKpiGrid loading={loading} kpis={data?.kpis} />

      {/* ── 6. Pipeline + Today's schedule ── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <AgentPipelineCard loading={loading} pipeline={data?.pipeline} />
        <AgentTodaySchedule loading={loading} tasks={data?.tasks} />
      </div>

      {/* ── 7. Leads Inbox + Listings ── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <AgentLeadsInbox loading={loading} leads={data?.leads} />
        <AgentListingsCard loading={loading} listings={data?.listings} />
      </div>

      {/* ── 8. Tasks (full width) ── */}
      <AgentTasksCard loading={loading} tasks={data?.tasks} />

    </div>
  );
}
