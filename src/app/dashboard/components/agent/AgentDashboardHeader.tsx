"use client";

import { Icon } from "@iconify/react";
import { formatDayLong } from "./utils";

export function AgentDashboardHeader({ userName }: { userName?: string | null }) {
  const today = formatDayLong();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#07090f] p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-slate-400">{today}</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-white">
            Dashboard Agent{" "}
            <span className="text-emerald-300">{userName || "Premier"}</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Fokus hari ini: follow-up lead, atur jadwal viewing, dan dorong closing lewat pipeline yang rapi.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
          <div className="h-9 w-9 rounded-xl border border-emerald-400/25 bg-emerald-500/10 flex items-center justify-center">
            <Icon icon="solar:bolt-circle-bold-duotone" className="text-xl text-emerald-200" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] text-slate-400">Mode</p>
            <p className="text-xs font-semibold text-white">Work Mode</p>
          </div>
        </div>
      </div>
    </div>
  );
}