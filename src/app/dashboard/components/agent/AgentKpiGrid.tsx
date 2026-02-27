"use client";

import { Icon } from "@iconify/react";
import type { AgentDashboardKpis } from "./types";
import { compactNumber, formatIDR } from "./utils";
import { cn } from "./utils";

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#07090f] p-5">
      <div className="h-10 w-10 rounded-xl bg-white/10 animate-pulse" />
      <div className="mt-4 h-4 w-24 bg-white/10 rounded animate-pulse" />
      <div className="mt-2 h-7 w-32 bg-white/10 rounded animate-pulse" />
      <div className="mt-3 h-3 w-40 bg-white/10 rounded animate-pulse" />
    </div>
  );
}

export function AgentKpiGrid({ loading, kpis }: { loading: boolean; kpis?: AgentDashboardKpis }) {
  const cards = [
    { icon: "solar:user-plus-bold-duotone", label: "Leads Baru (7 hari)", value: kpis ? compactNumber(kpis.newLeads7d) : "—", hint: "Sumber dari IG/WA/Referral" },
    { icon: "solar:clock-circle-bold-duotone", label: "Follow-up Due (hari ini)", value: kpis ? compactNumber(kpis.followupsDueToday) : "—", hint: "Prioritaskan yang HOT" },
    { icon: "solar:calendar-bold-duotone", label: "Viewing (7 hari)", value: kpis ? compactNumber(kpis.viewings7d) : "—", hint: "Jadwalkan ulang yang pending" },
    { icon: "solar:home-2-bold-duotone", label: "Active Listings", value: kpis ? compactNumber(kpis.activeListings) : "—", hint: "Listing aktif di marketplace" },
    { icon: "solar:hand-money-bold-duotone", label: "Negotiation", value: kpis ? compactNumber(kpis.negotiation) : "—", hint: "Deal yang butuh follow-up" },
    { icon: "solar:wallet-money-bold-duotone", label: "Komisi YTD", value: kpis ? formatIDR(kpis.commissionYtd) : "—", hint: "Total komisi tahun berjalan" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        : cards.map((c, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl border border-white/8 bg-[#07090f] p-5",
                "hover:border-emerald-400/20 hover:bg-white/[0.03] transition-all"
              )}
            >
              <div className="h-11 w-11 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center">
                <Icon icon={c.icon} className="text-2xl text-emerald-200" />
              </div>

              <p className="mt-4 text-xs text-slate-400">{c.label}</p>
              <p className="mt-1 text-2xl font-extrabold text-white tracking-tight">{c.value}</p>
              <p className="mt-2 text-[11px] text-slate-500">{c.hint}</p>
            </div>
          ))}
    </div>
  );
}