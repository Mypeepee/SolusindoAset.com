// app/dashboard/hrm/page.tsx
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAgents } from "./hooks/useAgents";
import { useAgentFilters } from "./hooks/useAgentFilters";
import { MetricsGrid } from "./components/overview/MetricsGrid";
import { AgentFiltersComponent } from "./components/agents/AgentFilters";
import { AgentTable } from "./components/agents/AgentTable";
import { AgentDetailPanel } from "./components/agents/AgentDetailPanel";
import { AgentDetailDrawer } from "./components/agents/AgentDetailDrawer";
import { Agent } from "./types/agent.types";
import { Icon } from "@iconify/react";

function isXlUp() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1280px)").matches;
}

function HRMContent() {
  const searchParams = useSearchParams();
  const targetAgentId = searchParams.get("agent");

  const { agents, loading, metrics, updateAgentStatus, updateAgentOffice } =
    useAgents();

  const { filters, setFilters, filteredAgents } = useAgentFilters(agents);

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const autoSelectedRef = useRef<string | null>(null);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    if (!isXlUp()) setDrawerOpen(true);
  };

  const handlePendingClick = () => {
    // Toggle: jika sudah memfilter PENDING, kembalikan ke semua agent.
    setFilters({
      search: "",
      status: filters.status === "PENDING" ? "" : "PENDING",
      jabatan: "",
      kota: "",
    });
    setTimeout(() => {
      document
        .getElementById("agent-list-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // Sinkronkan selectedAgent dengan data terbaru setiap kali daftar agent berubah
  // (misal setelah update status), supaya panel/drawer detail real-time.
  useEffect(() => {
    if (!selectedAgent) return;
    const updated = agents.find((a) => a.id_agent === selectedAgent.id_agent);
    if (updated && updated !== selectedAgent) setSelectedAgent(updated);
  }, [agents, selectedAgent]);

  // Auto-select agent dari query param setelah data load
  useEffect(() => {
    if (!targetAgentId || loading || agents.length === 0) return;
    if (autoSelectedRef.current === targetAgentId) return; // sudah di-handle, skip
    const match = agents.find((a) => a.id_agent === targetAgentId);
    if (!match) return;
    autoSelectedRef.current = targetAgentId;

    // Reset semua filter agar card pasti ada di DOM
    setFilters({ search: "", status: "", jabatan: "", kota: "" });
    setSelectedAgent(match);

    const isMobile = !window.matchMedia("(min-width: 1280px)").matches;

    if (isMobile) {
      // Mobile: scroll ke card dulu, baru buka drawer setelah card terlihat
      setTimeout(() => {
        document.getElementById(`agent-card-${match.id_agent}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      setTimeout(() => {
        setDrawerOpen(true);
      }, 450); // tunggu scroll selesai
    } else {
      // Desktop: scroll ke card, panel kanan otomatis tampil karena selectedAgent di-set
      setTimeout(() => {
        document.getElementById(`agent-card-${match.id_agent}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, loading, targetAgentId]);

  useEffect(() => {
    if (!drawerOpen) { document.body.style.overflow = ""; return; }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = () => { if (mq.matches) setDrawerOpen(false); };
    // @ts-ignore
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => {
      // @ts-ignore
      mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange);
    };
  }, []);

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
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
          Human Resource Management
        </h1>
        <p className="text-sm text-slate-400">
          Kelola agent, pantau performa, dan buat keputusan berbasis data real-time
        </p>
      </div>

      <MetricsGrid metrics={metrics} onPendingClick={handlePendingClick} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
        <div
          id="agent-list-section"
          className="bg-[#05060A] border border-white/5 rounded-2xl p-5 space-y-4 scroll-mt-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Daftar Agent</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Menampilkan {filteredAgents.length} dari {agents.length} agent
              </p>
            </div>
            {selectedAgent && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="xl:hidden px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/90 flex items-center gap-2 transition"
              >
                <Icon icon="solar:eye-bold" className="text-base text-emerald-200" />
                Lihat Detail
              </button>
            )}
          </div>

          <AgentFiltersComponent filters={filters} onFilterChange={setFilters} />

          <AgentTable
            agents={filteredAgents}
            onSelectAgent={handleSelectAgent}
            selectedId={selectedAgent?.id_agent}
          />
        </div>

        <div className="hidden xl:block bg-[#05060A] border border-white/5 rounded-2xl p-5 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
          <AgentDetailPanel
            agent={selectedAgent}
            onUpdateStatus={updateAgentStatus}
            onUpdateOffice={updateAgentOffice}
          />
        </div>
      </div>

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

export default function HRMPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Memuat data HRM...</p>
        </div>
      }
    >
      <HRMContent />
    </Suspense>
  );
}
