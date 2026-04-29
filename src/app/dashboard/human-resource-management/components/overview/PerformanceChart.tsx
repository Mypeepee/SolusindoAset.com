// app/dashboard/hrm/components/overview/PerformanceChart.tsx
"use client";

import { Agent } from "../../types/agent.types";
import { Icon } from "@iconify/react";
import { Avatar } from "../shared/Avatar";

interface PerformanceChartProps {
  agents: Agent[];
}

export function PerformanceChart({ agents }: PerformanceChartProps) {
  // Ambil top 10 performer
  const topPerformers = agents
    .sort((a, b) => b.jumlah_closing - a.jumlah_closing)
    .slice(0, 10);

  const maxClosing = Math.max(...topPerformers.map((a) => a.jumlah_closing));

  return (
    <div className="bg-[#05060A] border border-white/5 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Top Performers</h3>
          <p className="text-xs text-slate-400 mt-0.5">10 agent dengan closing tertinggi</p>
        </div>
        <Icon icon="solar:chart-2-bold" className="text-xl text-emerald-400" />
      </div>

      <div className="space-y-3">
        {topPerformers.map((agent, idx) => {
          const percentage = (agent.jumlah_closing / maxClosing) * 100;
          
          return (
            <div key={agent.id_agent} className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500 w-5">#{idx + 1}</span>
              
              <Avatar src={agent.foto_profil_url} name={agent.nama_lengkap} size="sm" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {agent.nama_lengkap}
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold">
                    {agent.jumlah_closing} closing
                  </span>
                </div>
                
                <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
