"use client";

import { Icon } from "@iconify/react";
import {
  AreaCompareChart,
  EMERALD,
  GroupedBarChart,
  MultiLineChart,
  StackedBarChart,
  TargetRealityBars,
} from "./charts";
import { useAgentKpiCards } from "@/app/dashboard/hooks/useAgentKpiCards";

/* ────────────────────────────────────────────────────────────────────
   Shared card shell — dark glass, emerald accents, premium hairlines.
   ──────────────────────────────────────────────────────────────────── */

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#0a0f10] to-[#070a0b] ${className}`}
    >
      {/* top hairline glow */}
      <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />
      {children}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex-shrink-0">{right}</div> : null}
    </div>
  );
}

function ExportBtn() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-emerald-500/10 hover:border-emerald-400/25 hover:text-emerald-200 transition"
    >
      <Icon icon="solar:download-minimalistic-bold-duotone" className="text-base" />
      Export
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────── */

function formatIDRCompact(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function deltaLabel(delta: number | null) {
  if (delta === null) return "Pertama kali bulan ini";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta}% vs bulan lalu`;
}

function deltaColor(delta: number | null) {
  if (delta === null) return "text-slate-500";
  return delta >= 0 ? "text-emerald-400" : "text-rose-400";
}

/* ────────────────────────────────────────────────────────────────────
   1. TODAY'S PERFORMANCE  +  4 live KPI tiles
   ──────────────────────────────────────────────────────────────────── */

function TodayPerformanceCard() {
  const { loading, data } = useAgentKpiCards();

  type Tile = {
    icon: string;
    value: string | null;
    label: string;
    delta: number | null;
    sublabel?: string | null;
    bg: string;
    blob: string;
    iconGrad: string;
    iconText: string;
    valueText: string;
    span2?: boolean;
  };

  const tiles: Tile[] = [
    {
      icon: "solar:wallet-money-bold-duotone",
      value: loading ? null : formatIDRCompact(data?.totalPendapatan ?? 0),
      label: "Total Pendapatan",
      delta: loading ? null : (data?.pendapatanDelta ?? null),
      bg: "linear-gradient(135deg,#064e3b 0%,#065f46 45%,#022c22 100%)",
      blob: "rgba(52,211,153,0.18)",
      iconGrad: "linear-gradient(135deg,#34d399,#059669)",
      iconText: "text-white",
      valueText: "text-emerald-100",
      span2: true,
    },
    {
      icon: "solar:medal-star-bold-duotone",
      value: loading ? null : String(data?.totalTransaksi ?? 0),
      label: "Total Transaksi",
      delta: null,
      sublabel: loading ? null : `${data?.transaksiBulanIni ?? 0} bulan ini  ·  ${data?.transaksiBulanLalu ?? 0} bulan lalu`,
      bg: "linear-gradient(135deg,#2e1065 0%,#4c1d95 45%,#1e1b4b 100%)",
      blob: "rgba(167,139,250,0.18)",
      iconGrad: "linear-gradient(135deg,#a78bfa,#7c3aed)",
      iconText: "text-white",
      valueText: "text-violet-100",
    },
    {
      icon: "solar:home-2-bold-duotone",
      value: loading ? null : String(data?.totalListing ?? 0),
      label: "Total Listing",
      delta: null,
      bg: "linear-gradient(135deg,#0c4a6e 0%,#0369a1 45%,#082f49 100%)",
      blob: "rgba(56,189,248,0.18)",
      iconGrad: "linear-gradient(135deg,#38bdf8,#0284c7)",
      iconText: "text-white",
      valueText: "text-sky-100",
    },
    {
      icon: "solar:user-plus-bold-duotone",
      value: loading ? null : String(data?.leadBaru ?? 0),
      label: "Lead Baru",
      delta: null,
      bg: "linear-gradient(135deg,#78350f 0%,#b45309 45%,#431407 100%)",
      blob: "rgba(251,191,36,0.18)",
      iconGrad: "linear-gradient(135deg,#fbbf24,#d97706)",
      iconText: "text-white",
      valueText: "text-amber-100",
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader
        title="Performa Keseluruhan"
        subtitle="Data real-time dari database"
        right={<ExportBtn />}
      />
      <div className="grid grid-cols-2 gap-3 px-6 pb-6 lg:grid-cols-5">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            style={{ background: t.bg }}
            className={`relative overflow-hidden rounded-2xl border border-white/[0.1] p-4 ${t.span2 ? "lg:col-span-2" : ""}`}
          >
            {/* ambient blob */}
            <div
              className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl"
              style={{ background: t.blob }}
            />
            {/* top hairline */}
            <div className="pointer-events-none absolute top-0 left-4 right-4 h-px bg-white/20" />

            {/* icon */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
              style={{ background: t.iconGrad }}
            >
              <Icon icon={t.icon} className={`text-lg ${t.iconText}`} />
            </div>

            {loading ? (
              <>
                <div className="mt-3 h-7 w-28 rounded-lg bg-white/10 animate-pulse" />
                <div className="mt-2 h-3 w-20 rounded bg-white/[0.07] animate-pulse" />
                <div className="mt-1.5 h-3 w-32 rounded bg-white/[0.05] animate-pulse" />
              </>
            ) : (
              <>
                <p className={`mt-3 text-xl font-extrabold tracking-tight leading-none ${t.valueText} ${t.span2 ? "lg:text-2xl" : ""}`}>
                  {t.value}
                </p>
                <p className="mt-1.5 text-xs font-semibold text-white/70">{t.label}</p>
                {t.sublabel ? (
                  <p className="mt-1 text-[10px] font-medium text-white/50">{t.sublabel}</p>
                ) : (
                  <div className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${deltaColor(t.delta)}`}>
                    {t.delta !== null && (
                      <Icon
                        icon={t.delta >= 0 ? "solar:arrow-up-bold" : "solar:arrow-down-bold"}
                        className="text-[9px]"
                      />
                    )}
                    {deltaLabel(t.delta)}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   2. VISITOR / INQUIRY INSIGHTS  (multi-line)
   ──────────────────────────────────────────────────────────────────── */

function VisitorInsightsCard() {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const series = [
    { name: "Loyal", color: EMERALD.bright,  data: [180, 220, 200, 250, 300, 270, 350, 320, 280, 240, 220, 200] },
    { name: "Baru",  color: EMERALD.primary, data: [120, 180, 220, 200, 240, 260, 220, 280, 240, 220, 180, 160] },
    { name: "Unik",  color: EMERALD.pale,    data: [80, 140, 160, 180, 220, 240, 200, 260, 220, 200, 160, 140] },
  ];

  return (
    <Card className="h-full">
      <CardHeader title="Insight Inquiry" subtitle="Tren pengunjung listing" />
      <div className="px-6">
        <MultiLineChart series={series} labels={labels} height={220} />
      </div>
      <div className="flex flex-wrap items-center gap-4 px-6 pb-6 pt-1">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full" style={{ background: s.color }} />
            <span className="text-[11px] text-slate-400">{s.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   3. TOTAL REVENUE  (grouped bars per day)
   ──────────────────────────────────────────────────────────────────── */

function TotalRevenueCard() {
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const groups = [
    { name: "Online",  color: EMERALD.primary, data: [13, 16, 6, 15, 11, 16, 19] },
    { name: "Offline", color: EMERALD.pale,    data: [12, 13, 22, 7, 11, 13, 12] },
  ];

  return (
    <Card className="h-full">
      <CardHeader title="Total Revenue" subtitle="Komisi mingguan (Jt)" />
      <div className="px-6">
        <GroupedBarChart categories={days} groups={groups} height={220} />
      </div>
      <div className="flex items-center justify-center gap-6 px-6 pb-6 pt-1">
        {groups.map((g) => (
          <div key={g.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
            <span className="text-[11px] text-slate-400">{g.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   4. CUSTOMER SATISFACTION → KONVERSI LEAD  (area)
   ──────────────────────────────────────────────────────────────────── */

function ConversionCard() {
  const labels = ["W1", "W2", "W3", "W4"];
  const previous = [42, 55, 48, 60];
  const current  = [55, 68, 64, 78];

  const sumCur  = current.reduce((a, b) => a + b, 0);
  const sumPrev = previous.reduce((a, b) => a + b, 0);

  return (
    <Card className="h-full">
      <CardHeader title="Konversi Lead" subtitle="Persentase lead → closing" />
      <div className="px-4">
        <AreaCompareChart current={current} previous={previous} labels={labels} height={220} />
      </div>
      <div className="grid grid-cols-2 gap-3 px-6 pb-6 pt-1">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-700" />
            <span className="text-[10px] text-slate-500">Bulan Lalu</span>
          </div>
          <p className="mt-1 text-base font-bold text-white">${sumPrev.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-slate-500">Bulan Ini</span>
          </div>
          <p className="mt-1 text-base font-bold text-emerald-300">${sumCur.toLocaleString()}</p>
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   5. TARGET vs REALITY
   ──────────────────────────────────────────────────────────────────── */

function TargetRealityCard() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const reality = [9.8, 7.2, 11.4, 9.1, 12.3, 10.6, 9.7];
  const target  = [10, 9.5, 10.2, 11, 11.5, 12, 12.5];

  return (
    <Card className="h-full">
      <CardHeader title="Target vs Realisasi" subtitle="Komisi (Jt) — target & aktual" />
      <div className="px-4">
        <TargetRealityBars categories={months} reality={reality} target={target} height={200} />
      </div>
      <div className="space-y-2 px-6 pb-6 pt-1">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] px-3 py-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-400/25 flex items-center justify-center">
            <Icon icon="solar:cup-star-bold-duotone" className="text-base text-emerald-300" />
          </div>
          <div className="flex-1 leading-tight">
            <p className="text-[11px] font-semibold text-white">Realisasi</p>
            <p className="text-[10px] text-slate-500">Aktual</p>
          </div>
          <p className="text-sm font-bold text-emerald-300">8.823</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-200/10 border border-emerald-200/20 flex items-center justify-center">
            <Icon icon="solar:target-bold-duotone" className="text-base text-emerald-100" />
          </div>
          <div className="flex-1 leading-tight">
            <p className="text-[11px] font-semibold text-white">Target</p>
            <p className="text-[10px] text-slate-500">Komersial</p>
          </div>
          <p className="text-sm font-bold text-emerald-100">12.122</p>
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   6. TOP LISTINGS
   ──────────────────────────────────────────────────────────────────── */

function TopListingsCard() {
  const rows = [
    { name: "Rumah Minimalis Citraland",   pop: 88, color: EMERALD.bright },
    { name: "Apartemen 2BR View Kota",     pop: 72, color: EMERALD.primary },
    { name: "Ruko Strategis Jalan Utama",  pop: 56, color: EMERALD.deep },
    { name: "Villa Modern Bali View",      pop: 44, color: EMERALD.pale },
  ];

  return (
    <Card className="h-full">
      <CardHeader title="Top Listings" subtitle="Listing paling diminati" />
      <div className="px-6 pb-6">
        <div className="grid grid-cols-[20px_1fr_90px_50px] items-center gap-3 border-b border-white/[0.05] pb-2 text-[10px] uppercase tracking-widest text-slate-600">
          <span>#</span>
          <span>Nama</span>
          <span>Popularitas</span>
          <span className="text-right">Sales</span>
        </div>
        <div className="mt-2 space-y-3">
          {rows.map((r, i) => (
            <div key={r.name} className="grid grid-cols-[20px_1fr_90px_50px] items-center gap-3">
              <span className="text-xs text-slate-500">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-xs font-medium text-slate-200 truncate">{r.name}</span>
              <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.pop}%`, background: r.color }}
                />
              </div>
              <span
                className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 text-center"
                style={{ borderColor: r.color + "40", color: r.color }}
              >
                {r.pop}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   7. SALES MAPPING (regions)
   ──────────────────────────────────────────────────────────────────── */

function SalesMappingCard() {
  const regions = [
    { name: "Jakarta",      value: 38, color: EMERALD.bright },
    { name: "Surabaya",     value: 28, color: EMERALD.primary },
    { name: "Bandung",      value: 18, color: EMERALD.deep },
    { name: "Bali",         value: 10, color: EMERALD.pale },
    { name: "Medan",        value: 6,  color: "#475569" },
  ];

  return (
    <Card className="h-full">
      <CardHeader title="Sebaran Penjualan" subtitle="Per wilayah Indonesia" />
      <div className="px-6 pb-6">
        {/* stylized archipelago silhouette */}
        <div className="relative h-32 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-transparent overflow-hidden">
          <svg viewBox="0 0 200 80" className="absolute inset-0 h-full w-full opacity-70">
            {/* Sumatera */}
            <path d="M10,30 Q15,20 25,22 L40,40 L35,50 L20,48 Z" fill="url(#map-grad)" stroke={EMERALD.primary} strokeWidth="0.5" />
            {/* Jawa */}
            <path d="M55,52 Q70,48 90,50 L100,55 L95,60 L60,58 Z" fill="url(#map-grad)" stroke={EMERALD.primary} strokeWidth="0.5" />
            {/* Bali */}
            <ellipse cx="105" cy="56" rx="3" ry="1.5" fill={EMERALD.bright} />
            {/* Kalimantan */}
            <path d="M75,15 Q90,12 105,18 L110,35 L100,40 L80,35 Z" fill="url(#map-grad)" stroke={EMERALD.primary} strokeWidth="0.5" />
            {/* Sulawesi */}
            <path d="M125,20 L130,30 L128,40 L135,42 L138,32 L142,28 L145,35 L140,45 L132,48 L125,42 Z" fill="url(#map-grad)" stroke={EMERALD.primary} strokeWidth="0.5" />
            {/* Papua */}
            <path d="M160,25 Q175,22 190,28 L185,42 L165,40 Z" fill="url(#map-grad)" stroke={EMERALD.primary} strokeWidth="0.5" />
            <defs>
              <linearGradient id="map-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={EMERALD.bright} stopOpacity="0.5" />
                <stop offset="100%" stopColor={EMERALD.deep} stopOpacity="0.15" />
              </linearGradient>
            </defs>
            {/* hot pins */}
            <circle cx="65" cy="55" r="3" fill={EMERALD.primary}>
              <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="85" cy="55" r="2" fill={EMERALD.bright} />
            <circle cx="105" cy="56" r="2" fill={EMERALD.bright} />
          </svg>
        </div>

        <div className="mt-4 space-y-2">
          {regions.map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
              <span className="flex-1 text-xs text-slate-300">{r.name}</span>
              <div className="h-1 w-20 rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.value * 2}%`, background: r.color }} />
              </div>
              <span className="text-[10px] font-semibold text-slate-400 w-8 text-right">{r.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   8. VOLUME vs SERVICE LEVEL
   ──────────────────────────────────────────────────────────────────── */

function VolumeServiceCard() {
  const labels = ["W1", "W2", "W3", "W4", "W5", "W6"];
  const bottom = [22, 35, 28, 40, 30, 25];   // volume
  const top    = [12, 18, 14, 20, 16, 13];   // service

  return (
    <Card className="h-full">
      <CardHeader title="Volume vs Layanan" subtitle="Inquiry & response per minggu" />
      <div className="px-4">
        <StackedBarChart
          categories={labels}
          bottom={bottom}
          top={top}
          bottomColor={EMERALD.primary}
          topColor={EMERALD.deep}
          height={200}
        />
      </div>
      <div className="flex items-center justify-around px-6 pb-6 pt-1">
        <div className="text-center">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-slate-400">Volume</span>
          </div>
          <p className="mt-1 text-sm font-bold text-white">{bottom.reduce((a, b) => a + b, 0)}</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="text-center">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-700" />
            <span className="text-[11px] text-slate-400">Layanan</span>
          </div>
          <p className="mt-1 text-sm font-bold text-white">{top.reduce((a, b) => a + b, 0)}</p>
        </div>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────
   PUBLIC: Premium Agent Dashboard layout (3 rows, emerald dark)
   ──────────────────────────────────────────────────────────────────── */

export function PremiumAgentDashboard() {
  return (
    <div className="space-y-5">
      {/* ROW 1 — 2/3 + 1/3 */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayPerformanceCard />
        </div>
        <VisitorInsightsCard />
      </div>

      {/* ROW 2 — 3 equal */}
      <div className="grid gap-5 lg:grid-cols-3">
        <TotalRevenueCard />
        <ConversionCard />
        <TargetRealityCard />
      </div>

      {/* ROW 3 — 3 equal */}
      <div className="grid gap-5 lg:grid-cols-3">
        <TopListingsCard />
        <SalesMappingCard />
        <VolumeServiceCard />
      </div>
    </div>
  );
}
