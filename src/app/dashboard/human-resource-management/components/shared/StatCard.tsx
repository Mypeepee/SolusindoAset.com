// app/dashboard/hrm/components/shared/StatCard.tsx
"use client";

import { Icon } from "@iconify/react";

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  change?: number; // % perubahan
  trend?: "up" | "down" | "neutral";
  subtitle?: string;
  colorScheme?: "emerald" | "amber" | "sky" | "violet" | "rose";
  onClick?: () => void;
}

type SchemeConfig = {
  glow: string; // radial ambient blob
  ring: string; // icon chip ring + shadow
  iconText: string;
  accent: string; // top hairline gradient
  valueGlow: string; // subtle text shadow tint
  hoverBorder: string;
};

const SCHEMES: Record<NonNullable<StatCardProps["colorScheme"]>, SchemeConfig> = {
  emerald: {
    glow: "bg-emerald-500/20",
    ring: "ring-emerald-400/30 shadow-[0_0_20px_-4px_rgba(16,185,129,0.55)]",
    iconText: "text-emerald-300",
    accent: "from-transparent via-emerald-400/70 to-transparent",
    valueGlow: "drop-shadow-[0_0_18px_rgba(16,185,129,0.25)]",
    hoverBorder: "group-hover:border-emerald-400/40",
  },
  sky: {
    glow: "bg-sky-500/20",
    ring: "ring-sky-400/30 shadow-[0_0_20px_-4px_rgba(56,189,248,0.55)]",
    iconText: "text-sky-300",
    accent: "from-transparent via-sky-400/70 to-transparent",
    valueGlow: "drop-shadow-[0_0_18px_rgba(56,189,248,0.25)]",
    hoverBorder: "group-hover:border-sky-400/40",
  },
  amber: {
    glow: "bg-amber-500/20",
    ring: "ring-amber-400/30 shadow-[0_0_20px_-4px_rgba(245,158,11,0.55)]",
    iconText: "text-amber-300",
    accent: "from-transparent via-amber-400/70 to-transparent",
    valueGlow: "drop-shadow-[0_0_18px_rgba(245,158,11,0.25)]",
    hoverBorder: "group-hover:border-amber-400/40",
  },
  violet: {
    glow: "bg-violet-500/20",
    ring: "ring-violet-400/30 shadow-[0_0_20px_-4px_rgba(139,92,246,0.55)]",
    iconText: "text-violet-300",
    accent: "from-transparent via-violet-400/70 to-transparent",
    valueGlow: "drop-shadow-[0_0_18px_rgba(139,92,246,0.25)]",
    hoverBorder: "group-hover:border-violet-400/40",
  },
  rose: {
    glow: "bg-rose-500/20",
    ring: "ring-rose-400/30 shadow-[0_0_20px_-4px_rgba(244,63,94,0.55)]",
    iconText: "text-rose-300",
    accent: "from-transparent via-rose-400/70 to-transparent",
    valueGlow: "drop-shadow-[0_0_18px_rgba(244,63,94,0.25)]",
    hoverBorder: "group-hover:border-rose-400/40",
  },
};

const TREND = {
  up: { icon: "solar:arrow-right-up-line-duotone", text: "text-emerald-300", bg: "bg-emerald-400/10 ring-emerald-400/20" },
  down: { icon: "solar:arrow-right-down-line-duotone", text: "text-rose-300", bg: "bg-rose-400/10 ring-rose-400/20" },
  neutral: { icon: "solar:minus-line-duotone", text: "text-slate-300", bg: "bg-white/5 ring-white/10" },
};

export function StatCard({
  icon,
  label,
  value,
  change,
  trend = "neutral",
  subtitle,
  colorScheme = "emerald",
  onClick,
}: StatCardProps) {
  const s = SCHEMES[colorScheme];
  const t = TREND[trend];
  const clickable = typeof onClick === "function";

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`
        group relative overflow-hidden rounded-2xl
        border border-white/[0.07] ${s.hoverBorder}
        bg-[#0a0c12]/80 backdrop-blur-xl
        p-5 transition-all duration-500 ease-out
        hover:-translate-y-1
        hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)]
        ${clickable ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:translate-y-0" : ""}
      `}
    >
      {/* Ambient corner glow */}
      <div
        className={`pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full ${s.glow} blur-3xl opacity-60 transition-opacity duration-500 group-hover:opacity-100`}
      />
      {/* Inner top sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />
      {/* Animated top accent hairline */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${s.accent} opacity-50 transition-opacity duration-500 group-hover:opacity-100`}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* Glowing icon chip */}
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ${s.ring} backdrop-blur-sm transition-transform duration-500 group-hover:scale-105`}
        >
          <Icon icon={icon} className={`text-xl ${s.iconText}`} />
        </div>

        {change !== undefined && (
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${t.bg} ${t.text}`}
          >
            <Icon icon={t.icon} className="text-sm" />
            <span className="tabular-nums">{Math.abs(change)}%</span>
          </div>
        )}
      </div>

      <div className="relative mt-4 space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <p
          className={`text-3xl font-semibold leading-none tracking-tight text-white tabular-nums ${s.valueGlow}`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="pt-0.5 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>

      {clickable && (
        <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-1 text-[11px] font-medium text-slate-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 -translate-x-1">
          Lihat
          <Icon icon="solar:arrow-right-line-duotone" className="text-sm" />
        </div>
      )}
    </div>
  );
}
