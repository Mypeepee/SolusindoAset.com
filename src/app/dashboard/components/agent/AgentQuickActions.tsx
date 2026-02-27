"use client";

import { Icon } from "@iconify/react";
import { cn } from "./utils";

export function AgentQuickActions({ onRefresh }: { onRefresh?: () => void }) {
  const actions = [
    { icon: "solar:home-add-bold-duotone", label: "Tambah Listing", hint: "Publikasikan properti baru", onClick: () => alert("TODO: route ke tambah listing") },
    { icon: "solar:user-plus-bold-duotone", label: "Tambah Lead", hint: "Catat lead dari WA/IG", onClick: () => alert("TODO: route ke tambah lead") },
    { icon: "solar:calendar-add-bold-duotone", label: "Jadwalkan Viewing", hint: "Atur kunjungan", onClick: () => alert("TODO: buka modal scheduling") },
    { icon: "solar:chat-round-call-bold-duotone", label: "Broadcast WA", hint: "Follow-up massal", onClick: () => alert("TODO: broadcast tool") },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={a.onClick}
          className={cn(
            "group text-left rounded-2xl border border-white/8 bg-[#07090f] p-4",
            "hover:border-emerald-400/30 hover:bg-white/[0.03] transition-all",
            "active:scale-[0.99]"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="h-11 w-11 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center group-hover:border-emerald-400/30 group-hover:bg-emerald-500/10 transition">
              <Icon icon={a.icon} className="text-2xl text-emerald-200" />
            </div>
            <Icon icon="solar:arrow-right-up-linear" className="text-lg text-slate-500 group-hover:text-emerald-200 transition" />
          </div>

          <p className="mt-3 text-sm font-bold text-white">{a.label}</p>
          <p className="mt-1 text-xs text-slate-400">{a.hint}</p>
        </button>
      ))}

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="sm:col-span-2 xl:col-span-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-xs text-slate-300 hover:bg-white/[0.04] hover:border-white/15 transition flex items-center justify-center gap-2"
        >
          <Icon icon="solar:refresh-bold" className="text-base text-emerald-200" />
          Refresh data
        </button>
      ) : null}
    </div>
  );
}