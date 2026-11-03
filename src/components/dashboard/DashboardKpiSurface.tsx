import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

/** Canonical KPI palette and surface shared with the active owner dashboard. */
export type DashboardAccent = "emerald" | "violet" | "sky" | "amber";

export const DASHBOARD_ACCENTS: Record<
  DashboardAccent,
  {
    base: string;
    orb: string;
    hairline: string;
    iconGrad: string;
    iconRing: string;
    iconShadow: string;
    valueGrad: string;
    chipBg: string;
    chipBorder: string;
    chipText: string;
    glow: string;
    primary: string;
    bottomGlow: string;
    hoverText: string;
  }
> = {
  emerald: {
    base: "linear-gradient(135deg, rgba(6,95,70,0.28) 0%, rgba(7,14,12,0.92) 55%, rgba(7,10,11,1) 100%)",
    orb: "radial-gradient(circle, rgba(52,211,153,0.38) 0%, transparent 65%)",
    hairline: "via-emerald-400/50",
    iconGrad: "linear-gradient(135deg, #34d399, #059669)",
    iconRing: "ring-emerald-300/25",
    iconShadow: "shadow-[0_10px_28px_-10px_rgba(16,185,129,0.65)]",
    valueGrad: "from-white via-white to-emerald-100",
    chipBg: "bg-emerald-500/15",
    chipBorder: "border-emerald-400/30",
    chipText: "text-emerald-300",
    glow: "rgba(52,211,153,0.28)",
    primary: "#34d399",
    bottomGlow: "via-emerald-400/25",
    hoverText: "group-hover:text-emerald-300",
  },
  violet: {
    base: "linear-gradient(135deg, rgba(76,29,149,0.30) 0%, rgba(11,9,22,0.92) 55%, rgba(7,10,11,1) 100%)",
    orb: "radial-gradient(circle, rgba(167,139,250,0.38) 0%, transparent 65%)",
    hairline: "via-violet-400/50",
    iconGrad: "linear-gradient(135deg, #a78bfa, #7c3aed)",
    iconRing: "ring-violet-300/25",
    iconShadow: "shadow-[0_10px_28px_-10px_rgba(139,92,246,0.65)]",
    valueGrad: "from-white via-white to-violet-100",
    chipBg: "bg-violet-500/15",
    chipBorder: "border-violet-400/30",
    chipText: "text-violet-300",
    glow: "rgba(167,139,250,0.28)",
    primary: "#a78bfa",
    bottomGlow: "via-violet-400/25",
    hoverText: "group-hover:text-violet-300",
  },
  sky: {
    base: "linear-gradient(135deg, rgba(7,89,133,0.30) 0%, rgba(8,14,22,0.92) 55%, rgba(7,10,11,1) 100%)",
    orb: "radial-gradient(circle, rgba(56,189,248,0.38) 0%, transparent 65%)",
    hairline: "via-sky-400/50",
    iconGrad: "linear-gradient(135deg, #38bdf8, #0284c7)",
    iconRing: "ring-sky-300/25",
    iconShadow: "shadow-[0_10px_28px_-10px_rgba(14,165,233,0.65)]",
    valueGrad: "from-white via-white to-sky-100",
    chipBg: "bg-sky-500/15",
    chipBorder: "border-sky-400/30",
    chipText: "text-sky-300",
    glow: "rgba(56,189,248,0.28)",
    primary: "#38bdf8",
    bottomGlow: "via-sky-400/25",
    hoverText: "group-hover:text-sky-300",
  },
  amber: {
    base: "linear-gradient(135deg, rgba(146,64,14,0.30) 0%, rgba(22,14,8,0.92) 55%, rgba(7,10,11,1) 100%)",
    orb: "radial-gradient(circle, rgba(251,191,36,0.38) 0%, transparent 65%)",
    hairline: "via-amber-400/50",
    iconGrad: "linear-gradient(135deg, #fbbf24, #d97706)",
    iconRing: "ring-amber-300/25",
    iconShadow: "shadow-[0_10px_28px_-10px_rgba(245,158,11,0.65)]",
    valueGrad: "from-white via-white to-amber-100",
    chipBg: "bg-amber-500/15",
    chipBorder: "border-amber-400/30",
    chipText: "text-amber-300",
    glow: "rgba(251,191,36,0.28)",
    primary: "#fbbf24",
    bottomGlow: "via-amber-400/25",
    hoverText: "group-hover:text-amber-300",
  },
};

export function DashboardKpiSurface({
  accent,
  children,
  className = "",
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { accent: DashboardAccent }) {
  const tone = DASHBOARD_ACCENTS[accent];
  return (
    <div
      {...props}
      data-dashboard-accent={accent}
      className={`group relative overflow-hidden rounded-3xl border border-white/[0.08] ${className}`}
      style={
        {
          background: tone.base,
          "--kpi-glow": tone.glow,
          ...style,
        } as CSSProperties
      }
    >
      {/* Top hairline */}
      <div
        className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent ${tone.hairline} to-transparent`}
      />

      {/* Ambient orb */}
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full blur-2xl transition-all duration-700 group-hover:scale-125 group-hover:blur-3xl"
        style={{ background: tone.orb }}
      />

      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Diagonal scan-line shimmer on hover */}
      <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 transition-all duration-1000 ease-out group-hover:left-[120%] group-hover:opacity-100" />

      {children}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent ${tone.bottomGlow} to-transparent opacity-50`}
      />
    </div>
  );
}

export function DashboardKpiIcon({
  accent,
  children,
  className = "",
}: {
  accent: DashboardAccent;
  children: ReactNode;
  className?: string;
}) {
  const tone = DASHBOARD_ACCENTS[accent];
  return (
    <span
      aria-hidden="true"
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${tone.iconRing} ${tone.iconShadow} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[4deg] ${className}`}
      style={{ background: tone.iconGrad }}
    >
      <span className="relative z-10 flex items-center justify-center text-white">
        {children}
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-60" />
      <span className="pointer-events-none absolute inset-1 rounded-xl ring-1 ring-white/15" />
    </span>
  );
}
