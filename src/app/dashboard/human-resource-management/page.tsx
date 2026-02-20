// app/dashboard/hrm/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAgents } from "./hooks/useAgents";
import { useAgentFilters } from "./hooks/useAgentFilters";
import { MetricsGrid } from "./components/overview/MetricsGrid";
import { AgentFiltersComponent } from "./components/agents/AgentFilters";
import { AgentTable } from "./components/agents/AgentTable";
import { AgentDetailPanel } from "./components/agents/AgentDetailPanel";
import { AgentDetailDrawer } from "./components/agents/AgentDetailDrawer";
import { Agent } from "./types/agent.types";
import { Icon } from "@iconify/react";

// helper: detect >= xl
function isXlUp() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1280px)").matches; // Tailwind xl
}

export default function HRMPage() {
  const { agents, loading, metrics, updateAgentStatus, updateAgentOffice } =
    useAgents();

  const { filters, setFilters, filteredAgents } = useAgentFilters(agents);

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // UX: lock scroll saat drawer open (mobile/tablet only)
  useEffect(() => {
    if (!drawerOpen) {
      document.body.style.overflow = "";
      return;
    }
    // drawer secara visual cuma muncul <xl, tapi lock scroll tetap aman
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // UX: ESC untuk close drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // UX: kalau user resize jadi xl ke atas, tutup drawer (biar desktop balik normal)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = () => {
      if (mq.matches) setDrawerOpen(false);
    };
    // dukung Safari lama
    // @ts-ignore
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => {
      // @ts-ignore
      mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange);
    };
  }, []);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);

    // ✅ hanya buka drawer kalau < xl
    if (!isXlUp()) {
      setDrawerOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Memuat data HRM...</p>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
          Human Resource Management
        </h1>
        <p className="text-sm text-slate-400">
          Kelola agent, pantau performa, dan buat keputusan berbasis data real-time
        </p>
      </div>

      {/* Metrics Overview */}
      <MetricsGrid metrics={metrics} />

      {/* Agent List & Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
        {/* List */}
        <div className="bg-[#05060A] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Daftar Agent</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Menampilkan {filteredAgents.length} dari {agents.length} agent
              </p>
            </div>

            {/* ✅ tombol hanya tampil <xl, dan hanya kalau sudah ada selected */}
            {selectedAgent ? (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="
                  xl:hidden
                  px-3 py-2 rounded-xl
                  border border-white/10 bg-white/5 hover:bg-white/10
                  text-xs text-white/90
                  flex items-center gap-2
                  transition
                "
              >
                <Icon
                  icon="solar:eye-bold"
                  className="text-base text-emerald-200"
                />
                Lihat Detail
              </button>
            ) : null}
          </div>

          <AgentFiltersComponent filters={filters} onFilterChange={setFilters} />

          <AgentTable
            agents={filteredAgents}
            onSelectAgent={handleSelectAgent}
            selectedId={selectedAgent?.id_agent}
          />
        </div>

        {/* ✅ Desktop panel (tetep sama seperti punyamu): hanya xl+ */}
        <div className="hidden xl:block bg-[#05060A] border border-white/5 rounded-2xl p-5 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
          <AgentDetailPanel
            agent={selectedAgent}
            onUpdateStatus={updateAgentStatus}
            onUpdateOffice={updateAgentOffice}
          />
        </div>
      </div>

      {/* ✅ Drawer: hanya <xl (pastikan AgentDetailDrawer root punya xl:hidden) */}
      <AgentDetailDrawer
        open={drawerOpen}
        agent={selectedAgent}
        onClose={() => setDrawerOpen(false)}
        onUpdateStatus={updateAgentStatus}
        onUpdateOffice={updateAgentOffice}
      />
    </div>
  );
}
