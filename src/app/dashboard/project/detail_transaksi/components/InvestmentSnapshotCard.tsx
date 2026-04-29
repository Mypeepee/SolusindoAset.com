import { Gauge } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { compactIDR, formatIDR, formatPercent, safeDivide, toNumber } from "./utils";
import { SectionCard } from "./shared";

function PrimaryMetric({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "emerald" | "cyan";
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "cyan"
      ? "text-cyan-300"
      : "text-white";

  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0b1017] p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className={`mt-3 text-[28px] font-semibold leading-none tracking-[-0.04em] ${valueClass}`}>
        {value}
      </div>
      <div className="mt-3 text-sm leading-6 text-slate-400">{helper}</div>
    </div>
  );
}

function SecondaryMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0a0e14] p-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  );
}

function getEstimatedMonths(project: ProjectDetailViewModel) {
  const source = project as Record<string, unknown>;

  const candidates = [
    "estimatedMonths",
    "estimatedDurationMonths",
    "estimatedExitMonths",
    "estimasiBulan",
    "estimasi_selesai_bulan",
    "estimasiSelesaiBulan",
    "estimasiExitBulan",
  ];

  for (const key of candidates) {
    const value = toNumber(source[key]);
    if (value > 0) return value;
  }

  return 0;
}

export default function InvestmentSnapshotCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const fundingTarget = toNumber(project.fundingTarget);
  const estimatedSellPrice = toNumber(project.estimatedSellPrice);
  const estimatedNetProfit = toNumber(project.estimatedNetProfit);
  const purchasePrice = toNumber(project.purchasePrice);
  const totalAcquisitionCost =
    toNumber(project.totalAcquisitionCost) || purchasePrice;

  const estimatedMonths = getEstimatedMonths(project);

  const capitalBase =
    totalAcquisitionCost > 0
      ? totalAcquisitionCost
      : fundingTarget > 0
      ? fundingTarget
      : purchasePrice;

  const totalROI = safeDivide(estimatedNetProfit, capitalBase);
  const monthlyROI = estimatedMonths > 0 ? totalROI / estimatedMonths : 0;
  const monthlyProfit =
    estimatedMonths > 0 ? estimatedNetProfit / estimatedMonths : 0;
  const profitMargin = safeDivide(estimatedNetProfit, estimatedSellPrice);

  return (
    <SectionCard
      eyebrow="Investment Snapshot"
      title="Tiga angka yang paling cepat dibaca investor"
      icon={<Gauge className="h-5 w-5" />}
    >
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <PrimaryMetric
            label="Estimasi harga jual"
            value={compactIDR(estimatedSellPrice)}
            helper={formatIDR(estimatedSellPrice)}
          />

          <PrimaryMetric
            label="Estimasi profit bersih"
            value={compactIDR(estimatedNetProfit)}
            helper={formatIDR(estimatedNetProfit)}
            tone="emerald"
          />

          <PrimaryMetric
            label="ROI / bulan"
            value={formatPercent(monthlyROI)}
            helper={
              estimatedMonths > 0
                ? `${formatPercent(totalROI)} total ROI dalam ${estimatedMonths} bulan`
                : `${formatPercent(totalROI)} total ROI`
            }
            tone="cyan"
          />
        </div>

        <div className="rounded-[26px] border border-white/10 bg-[#0a0e14] p-5">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Return overview
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                {formatPercent(totalROI)}
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Return total terhadap basis modal proyek
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Basis perhitungan
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {formatIDR(capitalBase)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SecondaryMetric
              label="Profit margin"
              value={formatPercent(profitMargin)}
              helper="Persentase profit terhadap estimasi harga jual"
            />

            <SecondaryMetric
              label="Profit / bulan"
              value={estimatedMonths > 0 ? compactIDR(monthlyProfit) : "—"}
              helper={
                estimatedMonths > 0
                  ? `${formatIDR(monthlyProfit)} rata-rata per bulan`
                  : "Durasi exit belum tersedia"
              }
            />

            <SecondaryMetric
              label="Durasi exit"
              value={estimatedMonths > 0 ? `${estimatedMonths} bulan` : "—"}
              helper="Estimasi waktu sampai aset dilepas"
            />

            <SecondaryMetric
              label="Basis modal"
              value={compactIDR(capitalBase)}
              helper={formatIDR(capitalBase)}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}