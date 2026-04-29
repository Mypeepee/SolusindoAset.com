import {
    ArrowDownLeft,
    ArrowUpRight,
    Landmark,
    Sparkles,
    Wallet2,
  } from "lucide-react";
  import { formatCurrency } from "../lib/format-currency";
  
  type SummaryTone =
    | "emerald"
    | "cyan"
    | "violet"
    | "amber"
    | "rose";
  
  const CARD_STYLES: Record<
    SummaryTone,
    {
      shell: string;
      glow: string;
      border: string;
      iconWrap: string;
      chip: string;
    }
  > = {
    emerald: {
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.26),transparent_42%),linear-gradient(135deg,rgba(16,185,129,0.92),rgba(5,150,105,0.86))]",
      glow: "shadow-[0_18px_60px_rgba(16,185,129,0.28)]",
      border: "border-emerald-300/25",
      iconWrap: "bg-white/18 text-white",
      chip: "bg-white/14 text-emerald-50 border-white/10",
    },
    cyan: {
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.28),transparent_42%),linear-gradient(135deg,rgba(8,145,178,0.95),rgba(14,116,144,0.88))]",
      glow: "shadow-[0_18px_60px_rgba(6,182,212,0.24)]",
      border: "border-cyan-300/25",
      iconWrap: "bg-white/18 text-white",
      chip: "bg-white/14 text-cyan-50 border-white/10",
    },
    violet: {
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.26),transparent_42%),linear-gradient(135deg,rgba(109,40,217,0.96),rgba(91,33,182,0.88))]",
      glow: "shadow-[0_18px_60px_rgba(124,58,237,0.26)]",
      border: "border-violet-300/25",
      iconWrap: "bg-white/18 text-white",
      chip: "bg-white/14 text-violet-50 border-white/10",
    },
    amber: {
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(253,230,138,0.3),transparent_42%),linear-gradient(135deg,rgba(245,158,11,0.96),rgba(217,119,6,0.9))]",
      glow: "shadow-[0_18px_60px_rgba(245,158,11,0.24)]",
      border: "border-amber-200/30",
      iconWrap: "bg-white/18 text-white",
      chip: "bg-white/14 text-amber-50 border-white/10",
    },
    rose: {
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(253,164,175,0.28),transparent_42%),linear-gradient(135deg,rgba(244,63,94,0.94),rgba(190,24,93,0.88))]",
      glow: "shadow-[0_18px_60px_rgba(244,63,94,0.24)]",
      border: "border-rose-200/30",
      iconWrap: "bg-white/18 text-white",
      chip: "bg-white/14 text-rose-50 border-white/10",
    },
  };
  
  function ShortNumber({ value }: { value: number }) {
    return (
      <span className="tabular-nums">
        {formatCurrency(value)}
      </span>
    );
  }
  
  export default function FundSummaryBar({
    projectName,
    totalBalance,
    totalIncome,
    totalExpense,
    totalRemainingBudget,
  }: {
    projectName: string;
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    totalRemainingBudget: number;
  }) {
    const items = [
      {
        label: "Saldo Kas",
        value: totalBalance,
        note: "Posisi kas bersih saat ini",
        tone: "emerald" as const,
        icon: Wallet2,
        chip: "Live balance",
      },
      {
        label: "Total Masuk",
        value: totalIncome,
        note: "Semua arus kas masuk project",
        tone: "cyan" as const,
        icon: ArrowDownLeft,
        chip: "Cash in",
      },
      {
        label: "Total Keluar",
        value: totalExpense,
        note: "Seluruh pengeluaran tercatat",
        tone: "rose" as const,
        icon: ArrowUpRight,
        chip: "Cash out",
      },
      {
        label: "Sisa Budget",
        value: totalRemainingBudget,
        note: "Budget yang masih tersedia",
        tone: "violet" as const,
        icon: Landmark,
        chip: "Remaining",
      },
    ];
  
    return (
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#07111f] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.1),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
  
        <div className="relative mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Fund Command Center
            </div>
  
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {projectName}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Ringkasan kas dan budget seluruh dompet project.
              </p>
            </div>
          </div>
  
          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right backdrop-blur md:block">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Overview
            </div>
            <div className="mt-1 text-sm font-medium text-slate-200">
              Premium cashflow cockpit
            </div>
          </div>
        </div>
  
        <div className="relative -mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid min-w-full grid-flow-col auto-cols-[84%] gap-4 px-1 sm:auto-cols-[360px] xl:auto-cols-fr">
            {items.map((item) => {
              const Icon = item.icon;
              const tone = CARD_STYLES[item.tone];
  
              return (
                <article
                  key={item.label}
                  className={[
                    "group relative overflow-hidden rounded-[28px] border p-5 text-white transition duration-300",
                    "min-h-[210px] snap-start backdrop-blur-xl",
                    "hover:-translate-y-1 hover:scale-[1.01]",
                    tone.shell,
                    tone.glow,
                    tone.border,
                  ].join(" ")}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_26%,transparent_74%,rgba(255,255,255,0.05))]" />
                  <div className="pointer-events-none absolute right-[-38px] top-[-38px] h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="pointer-events-none absolute bottom-[-48px] left-[-24px] h-28 w-28 rounded-full bg-black/10 blur-2xl" />
                  <div className="pointer-events-none absolute inset-y-5 right-4 w-px bg-white/10" />
  
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={[
                          "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 backdrop-blur-md",
                          tone.iconWrap,
                        ].join(" ")}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
  
                      <div
                        className={[
                          "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em]",
                          tone.chip,
                        ].join(" ")}
                      >
                        {item.chip}
                      </div>
                    </div>
  
                    <div className="mt-6">
                      <div className="text-sm font-medium text-white/78">
                        {item.label}
                      </div>
                      <div className="mt-2 text-[30px] font-semibold leading-none tracking-tight sm:text-[34px]">
                        <ShortNumber value={item.value} />
                      </div>
                    </div>
  
                    <div className="mt-auto flex items-end justify-between gap-3 pt-7">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-white/55">
                          Insight
                        </div>
                        <div className="mt-1 text-sm text-white/80">
                          {item.note}
                        </div>
                      </div>
  
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md">
                        <div className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]" />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }