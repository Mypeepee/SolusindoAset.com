import {
    ArrowDownRight,
    ArrowUpRight,
    FileCheck2,
    Hammer,
    PiggyBank,
    ShieldCheck,
    Wallet2,
  } from "lucide-react";
  import { formatCurrency } from "../lib/format-currency";
  import type { WalletSummary } from "../types";
  
  const WALLET_THEME: Record<
    string,
    {
      icon: typeof Wallet2;
      badge: string;
      shell: string;
      glow: string;
      border: string;
      badgeClass: string;
      iconWrap: string;
      progress: string;
    }
  > = {
    utama: {
      icon: Wallet2,
      badge: "Core Wallet",
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.14),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
      glow: "shadow-[0_18px_60px_rgba(16,185,129,0.14)]",
      border: "border-emerald-400/20",
      badgeClass: "border-emerald-300/15 bg-emerald-400/10 text-emerald-200",
      iconWrap: "border-emerald-300/20 bg-emerald-400/12 text-emerald-200",
      progress: "from-emerald-300 via-emerald-400 to-teal-300",
    },
    dokumen: {
      icon: FileCheck2,
      badge: "Legal Flow",
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.14),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
      glow: "shadow-[0_18px_60px_rgba(34,211,238,0.14)]",
      border: "border-cyan-400/20",
      badgeClass: "border-cyan-300/15 bg-cyan-400/10 text-cyan-200",
      iconWrap: "border-cyan-300/20 bg-cyan-400/12 text-cyan-200",
      progress: "from-cyan-300 via-sky-400 to-cyan-200",
    },
    eksekusi: {
      icon: ShieldCheck,
      badge: "Execution",
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(253,224,71,0.13),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
      glow: "shadow-[0_18px_60px_rgba(245,158,11,0.12)]",
      border: "border-amber-300/20",
      badgeClass: "border-amber-300/15 bg-amber-400/10 text-amber-200",
      iconWrap: "border-amber-300/20 bg-amber-400/12 text-amber-200",
      progress: "from-amber-200 via-amber-400 to-orange-300",
    },
    renovasi: {
      icon: Hammer,
      badge: "Renovation",
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.14),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
      glow: "shadow-[0_18px_60px_rgba(139,92,246,0.12)]",
      border: "border-violet-300/20",
      badgeClass: "border-violet-300/15 bg-violet-400/10 text-violet-200",
      iconWrap: "border-violet-300/20 bg-violet-400/12 text-violet-200",
      progress: "from-violet-200 via-violet-400 to-fuchsia-300",
    },
    cadangan: {
      icon: PiggyBank,
      badge: "Reserve",
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.14),transparent_34%),linear-gradient(135deg,rgba(7,18,33,0.98),rgba(7,28,46,0.96))]",
      glow: "shadow-[0_18px_60px_rgba(244,63,94,0.12)]",
      border: "border-rose-300/20",
      badgeClass: "border-rose-300/15 bg-rose-400/10 text-rose-200",
      iconWrap: "border-rose-300/20 bg-rose-400/12 text-rose-200",
      progress: "from-rose-200 via-rose-400 to-pink-300",
    },
  };
  
  function clampPercent(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }
  
  function formatDeltaPercent(value: number) {
    const abs = Math.abs(value);
    const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
    const digits = abs >= 10 ? 0 : 1;
    return `${prefix}${abs.toFixed(digits)}%`;
  }
  
  export default function WalletCard({
    wallet,
    active,
    onClick,
  }: {
    wallet: WalletSummary;
    active?: boolean;
    onClick?: () => void;
  }) {
    const theme = WALLET_THEME[wallet.walletKey] ?? WALLET_THEME.utama;
    const Icon = theme.icon;
  
    const budget = Number(wallet.budget ?? 0);
    const remaining = Number(wallet.remainingBudget ?? 0);
  
    const deltaAmount = remaining - budget;
    const deltaPercent = budget > 0 ? (deltaAmount / budget) * 100 : 0;
    const remainingPercent =
      budget > 0 ? clampPercent((remaining / budget) * 100) : 0;
  
    const trendClass =
      deltaAmount > 0
        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
        : deltaAmount < 0
        ? "border-rose-300/20 bg-rose-400/10 text-rose-200"
        : "border-white/10 bg-white/5 text-white/70";
  
    const TrendIcon =
      deltaAmount > 0 ? ArrowUpRight : deltaAmount < 0 ? ArrowDownRight : Wallet2;
  
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "group relative w-full snap-center snap-always overflow-hidden rounded-[30px] border p-6 text-left text-white",
          "min-h-[228px] backdrop-blur-xl transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60",
          active
            ? "border-cyan-300/40 ring-1 ring-cyan-300/60 shadow-[0_0_0_1px_rgba(103,232,249,0.18),0_24px_80px_rgba(8,145,178,0.18)]"
            : `${theme.border} ${theme.glow}`,
          theme.shell,
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_28%,transparent_74%,rgba(255,255,255,0.03))]" />
        <div className="pointer-events-none absolute -right-10 top-0 h-36 w-36 rounded-full bg-white/8 blur-3xl" />
        <div className="pointer-events-none absolute -left-6 bottom-0 h-28 w-28 rounded-full bg-cyan-400/8 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/10" />
  
        <div className="relative flex h-full flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={[
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] border backdrop-blur-md",
                  theme.iconWrap,
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
              </div>
  
              <div className="min-w-0">
                <div className="truncate text-base font-medium text-white/92">
                  {wallet.title}
                </div>
                <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-white/38">
                  Wallet overview
                </div>
              </div>
            </div>
  
            <div
              className={[
                "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em]",
                theme.badgeClass,
              ].join(" ")}
            >
              {theme.badge}
            </div>
          </div>
  
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">
              Sisa uang
            </div>
  
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 text-[clamp(1.8rem,4vw,2.5rem)] font-semibold leading-none tracking-tight text-white">
                {formatCurrency(remaining)}
              </div>
  
              <div
                className={[
                  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium",
                  trendClass,
                ].join(" ")}
              >
                <TrendIcon className="h-3.5 w-3.5" />
                <span>{formatDeltaPercent(deltaPercent)}</span>
              </div>
            </div>
  
            <div className="mt-2 text-sm text-white/42">
              Dibanding alokasi awal dompet
            </div>
          </div>
  
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">
                Progress tersisa
              </div>
  
              <div className="text-right">
                <div className="text-lg font-semibold text-white/86">
                  {remainingPercent.toFixed(0)}%
                </div>
              </div>
            </div>
  
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className={[
                  "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                  theme.progress,
                ].join(" ")}
                style={{ width: `${remainingPercent}%` }}
              />
            </div>
          </div>
        </div>
      </button>
    );
  }