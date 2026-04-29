"use client";

import { Icon } from "@iconify/react";

const stats = [
  {
    icon: "solar:users-group-rounded-bold",
    label: "Visitors",
    value: "2,110",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: "solar:dollar-minimalistic-bold",
    label: "Earnings",
    value: "$8.2M",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: "solar:cart-large-bold",
    label: "Orders",
    value: "1,124",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
];

export default function StatsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-2xl border border-white/5 bg-[#0a0c10] p-5 hover:border-white/10 transition-all"
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.bg}`}>
            <Icon icon={item.icon} className={`text-2xl ${item.color}`} />
          </div>
          <div>
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className="text-2xl font-bold text-white">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
