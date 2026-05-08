"use client";

import { Icon } from "@iconify/react";
import { cn } from "./utils";
import type { AgentYearlyComparison, YearlyMetric } from "./types";

/* ─── helpers ─────────────────────────────────────────────────────── */

function pctChange(cur: number, prev: number) {
  if (!prev) return 0;
  return ((cur - prev) / prev) * 100;
}

function formatIDR(n: number) {
  if (n >= 1_000_000_000)
    return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000_000)
    return `Rp ${(n / 1_000_000).toFixed(0)} Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatGeneral(n: number, unit?: string) {
  return `${n.toLocaleString("id-ID")}${unit ? ` ${unit}` : ""}`;
}

/* ─── Mini Sparkline SVG ───────────────────────────────────────────── */

function Sparkline({
  data,
  positive,
}: {
  data: number[];
  positive: boolean;
}) {
  const w = 88;
  const h = 32;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const area = `0,${h} ${polyline} ${w},${h}`;
  const color = positive ? "#34d399" : "#f87171";
  const gradId = positive ? "spark-green" : "spark-red";

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        points={polyline}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* last dot */}
      {pts.length > 0 && (() => {
        const last = pts[pts.length - 1].split(",");
        return (
          <circle
            cx={last[0]}
            cy={last[1]}
            r="2.5"
            fill={color}
            stroke="#07090f"
            strokeWidth="1.5"
          />
        );
      })()}
    </svg>
  );
}

/* ─── Single Stat Card ─────────────────────────────────────────────── */

type CardConfig = {
  label: string;
  icon: string;
  gradient: string;        // Tailwind bg gradient classes for icon blob
  borderGlow: string;      // subtle border + glow on hover
  metric: YearlyMetric;
  format: (n: number) => string;
};

function StatCard({ config, loading }: { config: CardConfig; loading: boolean }) {
  const { label, icon, gradient, borderGlow, metric, format } = config;
  const pct = pctChange(metric.thisYear, metric.lastYear);
  const positive = pct >= 0;
  const absStr = Math.abs(pct).toFixed(1);

  if (loading) {
    return (
      <div className="relative rounded-2xl border border-white/[0.06] bg-[#07090f] p-5 overflow-hidden">
        <div className="h-10 w-10 rounded-xl bg-white/[0.07] animate-pulse" />
        <div className="mt-4 h-3 w-20 rounded bg-white/[0.07] animate-pulse" />
        <div className="mt-2 h-7 w-28 rounded bg-white/[0.07] animate-pulse" />
        <div className="mt-3 h-3 w-32 rounded bg-white/[0.07] animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-[#07090f] p-5 overflow-hidden transition-all duration-300",
        "border-white/[0.06] hover:border-white/[0.12]",
        borderGlow
      )}
    >
      {/* ambient glow blob */}
      <div
        className={cn(
          "pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          gradient
        )}
      />

      {/* top row */}
      <div className="flex items-start justify-between">
        {/* icon */}
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08]",
            gradient
          )}
        >
          <Icon icon={icon} className="text-xl text-white/90" />
        </div>

        {/* change badge */}
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            positive
              ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20"
              : "bg-rose-400/10 text-rose-300 border border-rose-400/20"
          )}
        >
          <Icon
            icon={positive ? "solar:arrow-up-bold" : "solar:arrow-down-bold"}
            className="text-[10px]"
          />
          {absStr}%
        </div>
      </div>

      {/* label */}
      <p className="mt-4 text-[11px] font-medium uppercase tracking-widest text-slate-500">
        {label}
      </p>

      {/* main value */}
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-white leading-none">
        {format(metric.thisYear)}
      </p>

      {/* bottom row: vs last year + sparkline */}
      <div className="mt-4 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] text-slate-600">Tahun lalu</p>
          <p className="text-xs font-semibold text-slate-400">
            {format(metric.lastYear)}
          </p>
        </div>
        <Sparkline data={metric.monthly} positive={positive} />
      </div>

      {/* bottom divider line glow */}
      <div
        className={cn(
          "absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          positive ? "bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
                   : "bg-gradient-to-r from-transparent via-rose-400/40 to-transparent"
        )}
      />
    </div>
  );
}

/* ─── Public Component ─────────────────────────────────────────────── */

export function AgentYearlyStats({
  loading,
  data,
}: {
  loading: boolean;
  data?: AgentYearlyComparison;
}) {
  const empty: YearlyMetric = { thisYear: 0, lastYear: 0, monthly: Array(12).fill(0) };

  const cards: CardConfig[] = [
    {
      label: "Pendapatan",
      icon: "solar:wallet-money-bold-duotone",
      gradient: "bg-gradient-to-br from-emerald-500/30 to-emerald-700/10",
      borderGlow: "hover:shadow-[0_0_30px_rgba(52,211,153,0.06)]",
      metric: data?.pendapatan ?? empty,
      format: formatIDR,
    },
    {
      label: "Omzet",
      icon: "solar:graph-up-bold-duotone",
      gradient: "bg-gradient-to-br from-sky-500/30 to-sky-700/10",
      borderGlow: "hover:shadow-[0_0_30px_rgba(56,189,248,0.06)]",
      metric: data?.omzet ?? empty,
      format: formatIDR,
    },
    {
      label: "Total Transaksi",
      icon: "solar:hand-shake-bold-duotone",
      gradient: "bg-gradient-to-br from-violet-500/30 to-violet-700/10",
      borderGlow: "hover:shadow-[0_0_30px_rgba(167,139,250,0.06)]",
      metric: data?.totalTransaksi ?? empty,
      format: (n) => formatGeneral(n, "deal"),
    },
    {
      label: "Contacted",
      icon: "solar:phone-calling-bold-duotone",
      gradient: "bg-gradient-to-br from-amber-500/30 to-amber-700/10",
      borderGlow: "hover:shadow-[0_0_30px_rgba(251,191,36,0.06)]",
      metric: data?.contacted ?? empty,
      format: (n) => formatGeneral(n, "leads"),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <StatCard key={c.label} config={c} loading={loading} />
      ))}
    </div>
  );
}
