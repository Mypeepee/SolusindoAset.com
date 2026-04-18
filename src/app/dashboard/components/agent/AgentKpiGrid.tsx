"use client";

import { Icon } from "@iconify/react";
import type { AgentDashboardKpis } from "./types";
import { compactNumber, formatIDR, cn } from "./utils";

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#07090f] p-5">
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/8" />
        <div className="h-5 w-14 animate-pulse rounded-lg bg-white/5" />
      </div>
      <div className="mt-4 h-3 w-28 animate-pulse rounded bg-white/8" />
      <div className="mt-2 h-7 w-20 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-white/5" />
    </div>
  );
}

type KpiCard = {
  icon: string;
  label: string;
  value: string;
  hint: string;
  color: "emerald" | "sky" | "amber" | "rose" | "violet";
  progress?: number; // 0–100
  trend?: { dir: "up" | "down" | "flat"; label: string };
};

export function AgentKpiGrid({
  loading,
  kpis,
}: {
  loading: boolean;
  kpis?: AgentDashboardKpis;
}) {
  const cards: KpiCard[] = [
    {
      icon:     "solar:user-plus-bold-duotone",
      label:    "Leads Baru",
      value:    kpis ? compactNumber(kpis.newLeads7d) : "—",
      hint:     "7 hari terakhir",
      color:    "sky",
      progress: kpis ? Math.min((kpis.newLeads7d / 20) * 100, 100) : 0,
      trend:    { dir: "up", label: "vs minggu lalu" },
    },
    {
      icon:     "solar:clock-circle-bold-duotone",
      label:    "Follow-up Due",
      value:    kpis ? compactNumber(kpis.followupsDueToday) : "—",
      hint:     "Harus selesai hari ini",
      color:    kpis && kpis.followupsDueToday > 0 ? "rose" : "emerald",
      progress: kpis ? Math.min((kpis.followupsDueToday / 10) * 100, 100) : 0,
      trend:    kpis && kpis.followupsDueToday > 5
        ? { dir: "up",   label: "banyak pending" }
        : { dir: "flat", label: "dalam kontrol" },
    },
    {
      icon:     "solar:calendar-search-bold-duotone",
      label:    "Viewing",
      value:    kpis ? compactNumber(kpis.viewings7d) : "—",
      hint:     "7 hari terakhir",
      color:    "amber",
      progress: kpis ? Math.min((kpis.viewings7d / 15) * 100, 100) : 0,
      trend:    { dir: "up", label: "vs minggu lalu" },
    },
    {
      icon:     "solar:home-2-bold-duotone",
      label:    "Active Listings",
      value:    kpis ? compactNumber(kpis.activeListings) : "—",
      hint:     "Listing aktif di marketplace",
      color:    "emerald",
      progress: kpis ? Math.min((kpis.activeListings / 30) * 100, 100) : 0,
      trend:    { dir: "flat", label: "stabil" },
    },
    {
      icon:     "solar:hand-money-bold-duotone",
      label:    "Negotiation",
      value:    kpis ? compactNumber(kpis.negotiation) : "—",
      hint:     "Deal butuh follow-up",
      color:    kpis && kpis.negotiation > 0 ? "violet" : "emerald",
      progress: kpis ? Math.min((kpis.negotiation / 10) * 100, 100) : 0,
      trend:    { dir: "up", label: "siap closing" },
    },
    {
      icon:     "solar:wallet-money-bold-duotone",
      label:    "Komisi YTD",
      value:    kpis ? formatIDR(kpis.commissionYtd) : "—",
      hint:     "Total komisi tahun ini",
      color:    "emerald",
      progress: kpis ? Math.min((kpis.commissionYtd / 500_000_000) * 100, 100) : 0,
      trend:    { dir: "up", label: "on track target" },
    },
  ];

  const colorMap = {
    emerald: {
      iconBg:   "border-emerald-400/25 bg-emerald-500/10",
      iconText: "text-emerald-200",
      bar:      "bg-emerald-500/60",
      barBg:    "bg-emerald-500/10",
      trend:    "text-emerald-400",
    },
    sky: {
      iconBg:   "border-sky-400/25 bg-sky-500/10",
      iconText: "text-sky-200",
      bar:      "bg-sky-500/60",
      barBg:    "bg-sky-500/10",
      trend:    "text-sky-400",
    },
    amber: {
      iconBg:   "border-amber-400/25 bg-amber-500/10",
      iconText: "text-amber-200",
      bar:      "bg-amber-500/60",
      barBg:    "bg-amber-500/10",
      trend:    "text-amber-400",
    },
    rose: {
      iconBg:   "border-rose-400/25 bg-rose-500/10",
      iconText: "text-rose-200",
      bar:      "bg-rose-500/60",
      barBg:    "bg-rose-500/10",
      trend:    "text-rose-400",
    },
    violet: {
      iconBg:   "border-violet-400/25 bg-violet-500/10",
      iconText: "text-violet-200",
      bar:      "bg-violet-500/60",
      barBg:    "bg-violet-500/10",
      trend:    "text-violet-400",
    },
  };

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((c) => {
        const col = colorMap[c.color];
        const trendIcon =
          c.trend?.dir === "up"   ? "solar:arrow-up-bold"   :
          c.trend?.dir === "down" ? "solar:arrow-down-bold" :
          "solar:minus-bold";

        return (
          <div
            key={c.label}
            className={cn(
              "group relative rounded-2xl border border-white/8 bg-[#07090f] p-5",
              "hover:border-white/15 hover:bg-white/[0.02] transition-all duration-150",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                  col.iconBg,
                )}
              >
                <Icon icon={c.icon} className={cn("text-[22px]", col.iconText)} />
              </div>

              {/* Trend badge */}
              {c.trend && (
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-lg border border-white/8 bg-black/30 px-2 py-1",
                    col.trend,
                  )}
                >
                  <Icon icon={trendIcon} className="text-[10px]" />
                  <span className="text-[10px] font-semibold">{c.trend.label}</span>
                </div>
              )}
            </div>

            <p className="mt-4 text-[11px] font-medium text-slate-400">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-white">{c.value}</p>

            {/* Progress bar */}
            {c.progress !== undefined && (
              <div className={cn("mt-3 h-1 w-full rounded-full", col.barBg)}>
                <div
                  className={cn("h-full rounded-full transition-all", col.bar)}
                  style={{ width: `${c.progress}%` }}
                />
              </div>
            )}

            <p className="mt-2 text-[10px] text-slate-500">{c.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
