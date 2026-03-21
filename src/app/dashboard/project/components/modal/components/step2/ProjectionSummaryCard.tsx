"use client";

import {
  Clock3,
  Landmark,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { CreateProjectFormValues, ModalTierTheme } from "../../types";
import {
  formatCurrency,
  formatNumberDots,
  formatPercent,
  parseFormattedNumber,
} from "../../utils";

type Props = {
  form: CreateProjectFormValues;
  updateField: <K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) => void;
  inputClassName: string;
  theme: ModalTierTheme;
  hargaPembelianComputed: number;
  profitComputed: number;
  roiPercent: number;
  avgHargaPerMeter: number;
  suggestedSellPrice: number;
};

function getInputClassName(baseClassName: string) {
  return `${baseClassName} h-14 rounded-[20px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-slate-500`;
}

function getToneClass(value: number) {
  if (!Number.isFinite(value)) return "text-slate-300";
  return value >= 0 ? "text-emerald-300" : "text-rose-300";
}

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  valueClassName = "text-white",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  helper: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
      </div>
      <p className={`mt-3 text-[22px] font-bold tracking-tight ${valueClassName}`}>
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

function BenchmarkRow({
  title,
  subtitle,
  annualRateLabel,
  horizonProfit,
  horizonRoi,
  deltaVsProject,
}: {
  title: string;
  subtitle: string;
  annualRateLabel: string;
  horizonProfit: number;
  horizonRoi: number;
  deltaVsProject: number;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">
            {title}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{annualRateLabel}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
        </div>

        <div className="lg:text-right">
          <p className="text-base font-bold text-white">
            {formatCurrency(horizonProfit)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{formatPercent(horizonRoi)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Return Horizon Ini
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {formatCurrency(horizonProfit)}
          </p>
        </div>

        <div
          className={`rounded-[16px] border px-3 py-2.5 ${
            deltaVsProject >= 0
              ? "border-emerald-400/15 bg-emerald-500/[0.06]"
              : "border-rose-400/15 bg-rose-500/[0.06]"
          }`}
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Selisih vs Project
          </p>
          <p className={`mt-1 text-sm font-semibold ${getToneClass(deltaVsProject)}`}>
            {formatCurrency(deltaVsProject)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ProjectionSummaryCard({
  form,
  updateField,
  inputClassName,
  theme,
  hargaPembelianComputed,
  profitComputed,
  roiPercent,
  avgHargaPerMeter,
  suggestedSellPrice,
}: Props) {
  const premiumInputClassName = getInputClassName(inputClassName);

  const estimasiBulan = Number(form.estimasi_bulan || 0);
  const targetPendanaan = Number(form.target_pendanaan || 0);

  const pendanaanSpreadNominal = targetPendanaan - hargaPembelianComputed;
  const pendanaanSpreadPercent =
    hargaPembelianComputed > 0
      ? (pendanaanSpreadNominal / hargaPembelianComputed) * 100
      : 0;

  const signalActive = suggestedSellPrice > 0 || avgHargaPerMeter > 0;

  const depositoNetAnnual = 4.8;
  const rdpuNetAnnual = 5.5;

  const depositoHorizonRoi =
    estimasiBulan > 0 ? (depositoNetAnnual * estimasiBulan) / 12 : 0;
  const rdpuHorizonRoi =
    estimasiBulan > 0 ? (rdpuNetAnnual * estimasiBulan) / 12 : 0;

  const depositoHorizonProfit =
    hargaPembelianComputed > 0
      ? hargaPembelianComputed * (depositoHorizonRoi / 100)
      : 0;

  const rdpuHorizonProfit =
    hargaPembelianComputed > 0
      ? hargaPembelianComputed * (rdpuHorizonRoi / 100)
      : 0;

  const cmaProfit =
    suggestedSellPrice > 0 ? suggestedSellPrice - hargaPembelianComputed : 0;

  const cmaRoi =
    hargaPembelianComputed > 0 && suggestedSellPrice > 0
      ? (cmaProfit / hargaPembelianComputed) * 100
      : 0;

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,rgba(11,20,35,0.98),rgba(17,28,45,0.92)_48%,rgba(11,20,34,0.98))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_20%),radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.03),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/[0.04]" />
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute left-10 top-0 h-20 w-20 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Projection Engine
            </div>

            <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-white sm:text-[24px]">
              ROI, Profit & Target Pendanaan
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Finalisasi kebutuhan pendanaan, target exit, dan kualitas return
              project terhadap alternatif instrumen pasar uang.
            </p>
          </div>

          <div className="hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:block">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              CMA Signal
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white">
              {signalActive ? "Active" : "Waiting"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Estimasi Harga Jual
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(form.estimasi_harga_jual)}
                  onChange={(e) =>
                    updateField(
                      "estimasi_harga_jual",
                      parseFormattedNumber(e.target.value)
                    )
                  }
                  placeholder="0"
                  className={premiumInputClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Butuh Pendanaan Berapa
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(form.target_pendanaan)}
                  onChange={(e) =>
                    updateField(
                      "target_pendanaan",
                      parseFormattedNumber(e.target.value)
                    )
                  }
                  placeholder="0"
                  className={premiumInputClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Estimasi Berapa Bulan
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(form.estimasi_bulan)}
                  onChange={(e) =>
                    updateField(
                      "estimasi_bulan",
                      parseFormattedNumber(e.target.value)
                    )
                  }
                  placeholder="0"
                  className={premiumInputClassName}
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    suggestedSellPrice > 0 &&
                    updateField(
                      "estimasi_harga_jual",
                      Math.round(suggestedSellPrice)
                    )
                  }
                  disabled={suggestedSellPrice <= 0}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/15 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Gunakan Estimasi CMA
                </button>

                <div className="inline-flex h-11 items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200">
                  Saran:{" "}
                  {suggestedSellPrice > 0
                    ? formatCurrency(suggestedSellPrice)
                    : "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              icon={Wallet}
              label="Total Akuisisi"
              value={formatCurrency(hargaPembelianComputed)}
              helper="Baseline perhitungan proyeksi"
            />

            <StatCard
              icon={Target}
              label="Spread Pendanaan"
              value={
                hargaPembelianComputed > 0
                  ? formatPercent(pendanaanSpreadPercent)
                  : "-"
              }
              helper={`Spread nominal: ${formatCurrency(
                pendanaanSpreadNominal
              )} • Diharapkan +2% spread untuk dana darurat`}
              valueClassName={getToneClass(pendanaanSpreadNominal)}
            />

            <StatCard
              icon={TrendingUp}
              label="Est. Profit"
              value={formatCurrency(profitComputed)}
              helper="Harga jual - total akuisisi"
              valueClassName={getToneClass(profitComputed)}
            />

            <StatCard
              icon={Clock3}
              label="ROI & Pace"
              value={formatPercent(roiPercent)}
              helper={
                estimasiBulan > 0
                  ? `${formatPercent(
                      roiPercent / estimasiBulan
                    )} / bulan`
                  : "Isi estimasi bulan"
              }
              valueClassName={theme.accentText}
            />
          </div>
        </div>

        <div className="mt-4 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Benchmark Pembanding
              </p>
              <p className="mt-2 text-[22px] font-bold tracking-tight text-white">
                Alternatif Return
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Membandingkan return project terhadap instrumen yang lebih pasif
                pada horizon waktu yang sama.
              </p>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04]">
              <Landmark className="h-5 w-5 text-slate-300" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            <BenchmarkRow
              title="Deposito Neobank"
              subtitle="Asumsi bunga 6% gross, setara 4,8% net setelah pajak 20%."
              annualRateLabel="4,8% net / tahun"
              horizonProfit={depositoHorizonProfit}
              horizonRoi={depositoHorizonRoi}
              deltaVsProject={profitComputed - depositoHorizonProfit}
            />

            <BenchmarkRow
              title="RDPU"
              subtitle="Asumsi return bersih 5,5% per tahun dengan profil defensif."
              annualRateLabel="5,5% net / tahun"
              horizonProfit={rdpuHorizonProfit}
              horizonRoi={rdpuHorizonRoi}
              deltaVsProject={profitComputed - rdpuHorizonProfit}
            />

            {suggestedSellPrice > 0 ? (
              <BenchmarkRow
                title="CMA Benchmark"
                subtitle="Perbandingan terhadap suggested sell price dari engine CMA."
                annualRateLabel={`${formatCurrency(suggestedSellPrice)} exit`}
                horizonProfit={cmaProfit}
                horizonRoi={cmaRoi}
                deltaVsProject={profitComputed - cmaProfit}
              />
            ) : (
              <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">
                  CMA Benchmark
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  Belum tersedia
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Lengkapi input CMA untuk mengaktifkan benchmark exit dari engine CMA.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-[18px] border border-amber-400/15 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-100/90">
          <span className="font-semibold">Catatan proyeksi:</span> target exit
          yang sehat bukan cuma profit besar, tapi juga harus mengungguli alternatif
          pasif seperti deposito atau RDPU, sambil menjaga spread pendanaan tetap
          aman di atas baseline total akuisisi.
        </div>
      </div>
    </section>
  );
}