"use client";

import { Icon } from "@iconify/react";

export default function EarningsChart() {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a0c10] p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">Monthly Earnings</p>
          <p className="text-sm text-slate-300 mb-2">Total profit gained</p>
          <p className="text-3xl font-bold text-white">$25,049</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
            <Icon icon="solar:arrow-up-linear" className="text-sm" />
            +4.33%
            <span className="ml-1 text-slate-400">vs last month</span>
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/5">
          <Icon icon="solar:menu-dots-linear" className="text-slate-400" />
        </button>
      </div>

      {/* Placeholder chart (nanti pakai Recharts atau Chart.js) */}
      <div className="relative h-32 w-full rounded-xl bg-[#050608] border border-white/5 flex items-end justify-around px-4 pb-4">
        {[40, 60, 50, 80, 70, 90, 85].map((h, i) => (
          <div
            key={i}
            className="w-2 rounded-t-full bg-gradient-to-t from-blue-500 to-blue-300"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
