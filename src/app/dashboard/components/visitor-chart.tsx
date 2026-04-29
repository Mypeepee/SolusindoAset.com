"use client";

import { Icon } from "@iconify/react";

export default function VisitorChart() {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a0c10] p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">Visitor Value</p>
          <p className="text-sm text-slate-300 mb-2">Avg. income per site visit</p>
          <p className="text-3xl font-bold text-white">$63.02</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
            <Icon icon="solar:arrow-down-linear" className="text-sm" />
            -1.03%
            <span className="ml-1 text-slate-400">vs last month</span>
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/5">
          <Icon icon="solar:menu-dots-linear" className="text-slate-400" />
        </button>
      </div>

      {/* Bar chart placeholder */}
      <div className="relative h-24 w-full rounded-xl bg-[#050608] border border-white/5 flex items-end justify-around px-2 pb-2">
        {[50, 70, 80, 65, 90, 75, 85, 95, 70].map((h, i) => (
          <div
            key={i}
            className="w-1.5 rounded-t-sm bg-gradient-to-t from-blue-500 to-blue-300"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
