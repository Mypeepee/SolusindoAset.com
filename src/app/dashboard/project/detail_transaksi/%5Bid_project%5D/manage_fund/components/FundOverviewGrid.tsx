import {
    ArrowDownCircle,
    ArrowUpCircle,
    CircleDollarSign,
    ReceiptText,
  } from "lucide-react";
  
  import type { OverviewMetrics } from "./types";
  import { formatCompactIDR, formatIDR } from "./utils";
  
  function MiniCard({
    label,
    value,
    helper,
    icon,
    tone,
  }: {
    label: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
    tone: "emerald" | "rose" | "cyan" | "violet";
  }) {
    const toneMap = {
      emerald:
        "border-emerald-400/15 bg-emerald-400/10 text-emerald-200 shadow-[0_20px_60px_rgba(16,185,129,0.08)]",
      rose: "border-rose-400/15 bg-rose-400/10 text-rose-200 shadow-[0_20px_60px_rgba(244,63,94,0.08)]",
      cyan: "border-cyan-400/15 bg-cyan-400/10 text-cyan-200 shadow-[0_20px_60px_rgba(34,211,238,0.08)]",
      violet:
        "border-violet-400/15 bg-violet-400/10 text-violet-200 shadow-[0_20px_60px_rgba(167,139,250,0.08)]",
    };
  
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${toneMap[tone]}`}
        >
          {icon}
          {label}
        </div>
  
        <div className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {value}
        </div>
        <p className="mt-1 text-sm text-slate-400">{helper}</p>
      </div>
    );
  }
  
  export default function FundOverviewGrid({
    overview,
  }: {
    overview: OverviewMetrics;
  }) {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniCard
          label="Total pemasukan"
          value={formatCompactIDR(overview.totalPemasukan)}
          helper={formatIDR(overview.totalPemasukan)}
          tone="emerald"
          icon={<ArrowDownCircle className="h-4 w-4" />}
        />
        <MiniCard
          label="Total pengeluaran"
          value={formatCompactIDR(overview.totalPengeluaran)}
          helper={formatIDR(overview.totalPengeluaran)}
          tone="rose"
          icon={<ArrowUpCircle className="h-4 w-4" />}
        />
        <MiniCard
          label="Rerata nominal"
          value={formatCompactIDR(overview.rerataNominal)}
          helper="Nilai rata-rata per arus kas aktif"
          tone="cyan"
          icon={<CircleDollarSign className="h-4 w-4" />}
        />
        <MiniCard
          label="Status ledger"
          value={`${overview.transaksiDibayar} dibayar`}
          helper={`${overview.transaksiTercatat} masih tercatat`}
          tone="violet"
          icon={<ReceiptText className="h-4 w-4" />}
        />
      </section>
    );
  }