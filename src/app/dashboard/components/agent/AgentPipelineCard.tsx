"use client";

import { Icon } from "@iconify/react";
import type { AgentDashboardPipeline } from "./types";
import { compactNumber, cn } from "./utils";

function PipelineSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#07090f] p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-white/8" />
          <div className="h-5 w-44 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/8" />
      </div>
      <div className="mt-6 h-20 animate-pulse rounded-2xl bg-white/5" />
      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

type Stage = {
  key: keyof AgentDashboardPipeline;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  barColor: string;
  bgColor: string;
  borderColor: string;
};

const STAGES: Stage[] = [
  {
    key:         "contacted",
    label:       "Contacted",
    shortLabel:  "Kontak",
    icon:        "solar:phone-calling-rounded-bold-duotone",
    color:       "text-sky-200",
    barColor:    "bg-sky-500/50",
    bgColor:     "bg-sky-500/8",
    borderColor: "border-sky-400/20",
  },
  {
    key:         "qualified",
    label:       "Qualified",
    shortLabel:  "Kualifikasi",
    icon:        "solar:verified-check-bold-duotone",
    color:       "text-blue-200",
    barColor:    "bg-blue-500/50",
    bgColor:     "bg-blue-500/8",
    borderColor: "border-blue-400/20",
  },
  {
    key:         "viewing",
    label:       "Viewing",
    shortLabel:  "Viewing",
    icon:        "solar:eye-bold-duotone",
    color:       "text-violet-200",
    barColor:    "bg-violet-500/50",
    bgColor:     "bg-violet-500/8",
    borderColor: "border-violet-400/20",
  },
  {
    key:         "negotiation",
    label:       "Negotiation",
    shortLabel:  "Negosiasi",
    icon:        "solar:hand-money-bold-duotone",
    color:       "text-amber-200",
    barColor:    "bg-amber-500/50",
    bgColor:     "bg-amber-500/8",
    borderColor: "border-amber-400/20",
  },
  {
    key:         "closed",
    label:       "Closed",
    shortLabel:  "Closing",
    icon:        "solar:medal-star-bold-duotone",
    color:       "text-emerald-200",
    barColor:    "bg-emerald-500/60",
    bgColor:     "bg-emerald-500/10",
    borderColor: "border-emerald-400/25",
  },
];

function conversionRate(from: number, to: number) {
  if (!from) return "—";
  return `${Math.round((to / from) * 100)}%`;
}

export function AgentPipelineCard({
  loading,
  pipeline,
}: {
  loading: boolean;
  pipeline?: AgentDashboardPipeline;
}) {
  if (loading) return <PipelineSkeleton />;

  const p = pipeline ?? { contacted: 0, qualified: 0, viewing: 0, negotiation: 0, closed: 0 };
  const values = STAGES.map((s) => Number(p[s.key]) || 0);
  const total  = values.reduce((a, b) => a + b, 0);
  const max    = Math.max(1, ...values);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-[#07090f] p-6">
      {/* Glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full bg-emerald-500/6 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-sky-500/6 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">CRM</p>
          <h3 className="mt-0.5 text-base font-bold text-white">Sales Pipeline</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Total <span className="text-white font-semibold">{compactNumber(total)}</span> leads aktif di
            pipeline &mdash; lihat bottleneck dan dorong konversi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-center">
            <p className="text-[10px] text-slate-500">Total</p>
            <p className="text-sm font-extrabold text-white">{compactNumber(total)}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
            <Icon icon="solar:diagram-up-bold-duotone" className="text-xl text-emerald-200" />
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="relative mt-6 rounded-2xl border border-white/8 bg-black/20 p-4">
        <div className="flex items-end gap-2 h-28">
          {STAGES.map((s, i) => {
            const val = values[i];
            const h   = Math.max(6, (val / max) * 100);
            return (
              <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
                <p className="text-[10px] font-bold text-white tabular-nums">{val}</p>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-xl border transition-all",
                      s.barColor,
                      s.borderColor,
                    )}
                    style={{ height: `${h}%` }}
                    title={`${s.label}: ${val}`}
                  />
                </div>
                <p className="text-[9px] text-slate-500 text-center leading-tight">{s.shortLabel}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage cards */}
      <div className="relative mt-4 grid grid-cols-5 gap-2">
        {STAGES.map((s, i) => {
          const val  = values[i];
          const next = i < STAGES.length - 1 ? values[i + 1] : null;
          return (
            <div
              key={s.key}
              className={cn(
                "rounded-2xl border p-3 transition-all hover:scale-[1.02]",
                s.bgColor,
                s.borderColor,
              )}
            >
              <Icon icon={s.icon} className={cn("text-xl", s.color)} />
              <p className={cn("mt-2 text-lg font-extrabold tabular-nums", s.color)}>{val}</p>
              <p className="text-[9px] font-medium text-slate-400 leading-tight mt-0.5">{s.shortLabel}</p>

              {/* Conversion rate to next stage */}
              {next !== null && (
                <p className="mt-1.5 text-[9px] text-slate-600">
                  → {conversionRate(val, next)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Conversion summary */}
      <div className="relative mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon icon="solar:chart-2-bold-duotone" className="text-base text-emerald-200" />
          <p className="text-xs text-slate-400">
            Contacted → Closing:{" "}
            <span className="font-bold text-emerald-200">
              {conversionRate(p.contacted, p.closed)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="solar:medal-star-bold-duotone" className="text-base text-emerald-200" />
          <p className="text-xs text-slate-400">
            Closed: <span className="font-bold text-white">{p.closed}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
