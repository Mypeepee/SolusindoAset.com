"use client";

import { Icon } from "@iconify/react";
import type { AgentDashboardPipeline } from "./types";
import { clamp } from "./utils";

function PipelineSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
      <div className="mt-5 h-28 bg-white/5 rounded-2xl animate-pulse" />
      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-white/10 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function AgentPipelineCard({ loading, pipeline }: { loading: boolean; pipeline?: AgentDashboardPipeline }) {
  if (loading) return <PipelineSkeleton />;

  const p = pipeline || { contacted: 0, qualified: 0, viewing: 0, negotiation: 0, closed: 0 };
  const steps = [
    { key: "contacted", label: "Contacted", icon: "solar:phone-calling-rounded-bold-duotone", value: p.contacted },
    { key: "qualified", label: "Qualified", icon: "solar:verified-check-bold-duotone", value: p.qualified },
    { key: "viewing", label: "Viewing", icon: "solar:calendar-search-bold-duotone", value: p.viewing },
    { key: "negotiation", label: "Negotiation", icon: "solar:hand-money-bold-duotone", value: p.negotiation },
    { key: "closed", label: "Closed", icon: "solar:medal-star-bold-duotone", value: p.closed },
  ];

  const max = Math.max(1, ...steps.map((s) => Number(s.value) || 0));

  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6 overflow-hidden relative">
      <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Pipeline</p>
          <h3 className="mt-1 text-base font-bold text-white">Dari Lead ke Closing</h3>
          <p className="mt-1 text-[11px] text-slate-500">Lihat bottleneck kamu, lalu fokus di step paling lemah.</p>
        </div>

        <div className="h-10 w-10 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center">
          <Icon icon="solar:diagram-up-bold-duotone" className="text-xl text-emerald-200" />
        </div>
      </div>

      {/* mini chart */}
      <div className="relative mt-5 rounded-2xl border border-white/8 bg-black/25 p-4">
        <div className="grid grid-cols-5 gap-3 items-end h-28">
          {steps.map((s) => {
            const h = clamp((Number(s.value) / max) * 100, 6, 100);
            return (
              <div key={s.key} className="flex flex-col items-center gap-2">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-2xl border border-emerald-400/25 bg-gradient-to-t from-emerald-500/20 via-emerald-500/10 to-sky-500/10"
                    style={{ height: `${h}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* numbers */}
      <div className="relative mt-4 grid grid-cols-5 gap-2">
        {steps.map((s) => (
          <div key={s.key} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
            <div className="flex items-center gap-2">
              <Icon icon={s.icon} className="text-lg text-emerald-200" />
              <p className="text-[11px] text-slate-400">{s.label}</p>
            </div>
            <p className="mt-2 text-lg font-extrabold text-white">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}