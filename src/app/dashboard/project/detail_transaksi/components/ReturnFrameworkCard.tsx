import { TrendingUp } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import {
  formatIDR,
  formatNumber,
  formatPercent,
  safeDivide,
  toNumber,
} from "./utils";
import { EmptyState, SectionCard } from "./shared";

function pickNumber(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return 0;
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value > 0) return value;
  }

  return 0;
}

function formatIDRNumberOnly(value: number) {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

type ScenarioTone = "bear" | "base" | "bull";

type Scenario = {
  key: ScenarioTone;
  label: string;
  subtitle: string;
  pricePerMeter: number;
  estimatedSellPrice: number;
  estimatedGrossProfit: number;
  roi: number;
  profitMargin: number;
};

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="min-w-0 text-right font-mono text-[13px] font-medium tabular-nums text-slate-100 sm:text-sm">
        {value}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.035] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 font-mono text-[15px] font-semibold leading-none tabular-nums text-white sm:text-[16px] lg:text-[17px]">
        {value}
      </div>
    </div>
  );
}

function ScenarioBlock({ scenario }: { scenario: Scenario }) {
  const toneStyles: Record<
    ScenarioTone,
    {
      border: string;
      shell: string;
      badge: string;
      accent: string;
      price: string;
      profit: string;
      chip: string;
    }
  > = {
    bear: {
      border: "border-rose-200/16",
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.11),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(24,39,75,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.028),rgba(255,255,255,0.015))]",
      badge:
        "border border-rose-200/18 bg-rose-300/10 text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
      accent: "bg-rose-200/70",
      price: "text-rose-50",
      profit: "text-rose-100",
      chip: "text-slate-300",
    },
    base: {
      border: "border-[#d7b56d]/20",
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(215,181,109,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(24,39,75,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.028),rgba(255,255,255,0.015))]",
      badge:
        "border border-[#d7b56d]/20 bg-[#d7b56d]/10 text-[#f1ddb0] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
      accent: "bg-[#d7b56d]",
      price: "text-white",
      profit: "text-[#f1ddb0]",
      chip: "text-slate-300",
    },
    bull: {
      border: "border-emerald-200/16",
      shell:
        "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.11),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(24,39,75,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.028),rgba(255,255,255,0.015))]",
      badge:
        "border border-emerald-200/16 bg-emerald-300/10 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
      accent: "bg-emerald-200/80",
      price: "text-emerald-50",
      profit: "text-emerald-100",
      chip: "text-slate-300",
    },
  };

  const style = toneStyles[scenario.key];

  return (
    <div
      className={[
        "relative isolate w-full min-w-0 overflow-hidden rounded-[28px] border p-4 sm:p-4.5 lg:p-5",
        style.border,
        style.shell,
        "shadow-[0_20px_60px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/[0.035]" />

      <div className="relative z-10 flex min-w-0 items-start justify-between gap-3">
        <span
          className={[
            "inline-flex rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.26em]",
            style.badge,
          ].join(" ")}
        >
          {scenario.label}
        </span>

        <span
          className={[
            "min-w-0 max-w-[46%] truncate rounded-full border border-white/8 bg-white/[0.035] px-3 py-1.5 text-right font-mono text-[10px] tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:text-[11px]",
            style.chip,
          ].join(" ")}
          title={`${formatIDR(scenario.pricePerMeter)}/m²`}
        >
          {formatIDR(scenario.pricePerMeter)}/m²
        </span>
      </div>

      <div className="relative z-10 mt-4 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${style.accent}`} />
        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
          {scenario.subtitle}
        </div>
      </div>

      <div className="relative z-10 mt-4 border-t border-white/6 pt-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
          Estimasi harga jual
        </div>

        <div className="mt-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-400">
            Rp
          </div>
          <div
            className={[
              "mt-1 break-words font-mono text-[20px] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-[22px] lg:text-[24px]",
              style.price,
            ].join(" ")}
          >
            {formatIDRNumberOnly(scenario.estimatedSellPrice)}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-2 gap-3">
        <StatBox label="ROI" value={formatPercent(scenario.roi)} />
        <StatBox
          label="Profit margin"
          value={formatPercent(scenario.profitMargin)}
        />
      </div>

      <div className="relative z-10 mt-3 rounded-[20px] border border-white/8 bg-white/[0.035] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
          Profit kotor
        </div>
        <div
          className={[
            "mt-2 font-mono text-[16px] font-semibold leading-none tabular-nums sm:text-[17px] lg:text-[18px]",
            style.profit,
          ].join(" ")}
        >
          {formatIDR(scenario.estimatedGrossProfit)}
        </div>
      </div>
    </div>
  );
}

export default function ReturnFrameworkCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const fundingTarget = toNumber(project.fundingTarget);
  const purchasePrice = toNumber(project.purchasePrice);
  const totalAcquisitionCost =
    toNumber(project.totalAcquisitionCost) || purchasePrice;

  const subjectLandArea = pickNumber(project, [
    "landArea",
    "luasTanah",
    "assetLandArea",
    "propertyLandArea",
    "luas_tanah",
  ]);

  const comparablePricePerMeter = project.cma
    .map((item) => {
      const landArea = toNumber(item.landArea);
      const price = toNumber(item.price);
      return landArea > 0 && price > 0 ? price / landArea : 0;
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  if (subjectLandArea <= 0) {
    return (
      <SectionCard
        eyebrow="Return Framework"
        title="Model hasil investasi"
        icon={<TrendingUp className="h-5 w-5" />}
      >
        <EmptyState text="Luas tanah belum tersedia. Return framework skenario membutuhkan luas tanah untuk menghitung estimasi harga jual." />
      </SectionCard>
    );
  }

  if (comparablePricePerMeter.length === 0) {
    return (
      <SectionCard
        eyebrow="Return Framework"
        title="Model hasil investasi"
        icon={<TrendingUp className="h-5 w-5" />}
      >
        <EmptyState text="Belum ada data CMA yang valid. Tambahkan pembanding pasar agar bear, base, dan bull case bisa dihitung." />
      </SectionCard>
    );
  }

  const minPricePerMeter = Math.min(...comparablePricePerMeter);
  const avgPricePerMeter =
    comparablePricePerMeter.reduce((sum, value) => sum + value, 0) /
    comparablePricePerMeter.length;
  const maxPricePerMeter = Math.max(...comparablePricePerMeter);

  const scenarioSources = [
    {
      key: "bear" as const,
      label: "Bear Case",
      subtitle: "CMA terendah per m²",
      pricePerMeter: minPricePerMeter,
    },
    {
      key: "base" as const,
      label: "Base Case",
      subtitle: "Rata-rata CMA per m²",
      pricePerMeter: avgPricePerMeter,
    },
    {
      key: "bull" as const,
      label: "Bull Case",
      subtitle: "CMA tertinggi dikurangi 15%",
      pricePerMeter: maxPricePerMeter * 0.85,
    },
  ];

  const scenarios: Scenario[] = scenarioSources.map((item) => {
    const estimatedSellPrice = item.pricePerMeter * subjectLandArea;
    const estimatedGrossProfit = estimatedSellPrice - totalAcquisitionCost;
    const roi = safeDivide(estimatedGrossProfit, fundingTarget);
    const profitMargin = safeDivide(estimatedGrossProfit, estimatedSellPrice);

    return {
      key: item.key,
      label: item.label,
      subtitle: item.subtitle,
      pricePerMeter: item.pricePerMeter,
      estimatedSellPrice,
      estimatedGrossProfit,
      roi,
      profitMargin,
    };
  });

  return (
    <SectionCard
      eyebrow="Return Framework"
      title="Model hasil investasi"
      icon={<TrendingUp className="h-5 w-5" />}
      right={
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          3 skenario
        </span>
      }
    >
      <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(215,181,109,0.05),transparent_18%),radial-gradient(circle_at_top_right,rgba(71,120,255,0.05),transparent_20%),linear-gradient(180deg,#0b1017_0%,#080d14_100%)] p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="mb-4 px-1 text-sm leading-6 text-slate-400">
          Tiga skenario exit value berbasis CMA untuk membaca range hasil investasi secara cepat.
        </div>

        <div className="grid gap-3">
          {scenarios.map((scenario) => (
            <ScenarioBlock key={scenario.key} scenario={scenario} />
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <MetaRow label="LT aset" value={`${formatNumber(subjectLandArea)} m²`} />
          <MetaRow label="Target pendanaan" value={formatIDR(fundingTarget)} />
          <MetaRow
            label="Total biaya akuisisi"
            value={formatIDR(totalAcquisitionCost)}
          />
        </div>
      </div>
    </SectionCard>
  );
}