"use client";

import { useMemo } from "react";
import {
  BarChart3,
  Bot,
  CircleDollarSign,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type {
  CmaEntry,
  CreateProjectFormValues,
  ListingOption,
} from "../../types";
import {
  createEmptyCmaEntry,
  formatCurrency,
  formatNumberDots,
  parseFormattedNumber,
} from "../../utils";

type Props = {
  form: CreateProjectFormValues;
  selectedListing?: ListingOption | null;
  updateField: <K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) => void;
  inputClassName: string;
  avgHargaPerMeter: number;
  suggestedSellPrice: number;
};

function getInputClassName(baseClassName: string) {
  return `${baseClassName} h-12 rounded-[18px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-slate-500 text-center`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getComparisonTone(value: number) {
  if (!Number.isFinite(value)) {
    return "text-slate-300";
  }

  if (value >= 0) return "text-emerald-300";
  return "text-rose-300";
}

function getDecision(
  acquisitionPerMeter: number,
  marketLowest: number,
  marketAverage: number,
  marketHighest: number,
  allRowsCompleted: boolean
) {
  if (!allRowsCompleted || acquisitionPerMeter <= 0) {
    return {
      label: "Menunggu data lengkap",
      tone: "border-white/10 bg-white/[0.04] text-slate-200",
      desc: "Lengkapi seluruh data CMA agar keputusan beli lebih valid.",
    };
  }

  if (acquisitionPerMeter <= marketLowest) {
    return {
      label: "Sangat worth it",
      tone: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      desc: "Harga masuk berada di bawah market floor. Secara pricing sangat menarik.",
    };
  }

  if (acquisitionPerMeter <= marketAverage * 0.92) {
    return {
      label: "Worth it dibeli",
      tone: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      desc: "Harga masuk masih punya diskon sehat terhadap rata-rata market.",
    };
  }

  if (acquisitionPerMeter <= marketAverage * 1.02) {
    return {
      label: "Borderline menarik",
      tone: "border-amber-400/20 bg-amber-500/10 text-amber-200",
      desc: "Masih bisa diambil, tapi margin keamanannya mulai menipis.",
    };
  }

  if (acquisitionPerMeter <= marketHighest) {
    return {
      label: "Kurang menarik",
      tone: "border-rose-400/20 bg-rose-500/10 text-rose-200",
      desc: "Harga masuk sudah di atas rata-rata market dan mendekati area mahal.",
    };
  }

  return {
    label: "Tidak worth it",
    tone: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    desc: "Harga masuk sudah melampaui range market yang teramati.",
  };
}

function ComparisonRow({
  label,
  benchmark,
  benchmarkLabel,
  diffPercent,
}: {
  label: string;
  benchmark: number;
  benchmarkLabel: string;
  diffPercent: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-sm text-slate-300">
          {benchmark > 0 ? `${benchmarkLabel} • ${formatCurrency(benchmark)}` : "-"}
        </p>
      </div>

      <div className={`shrink-0 text-sm font-semibold ${getComparisonTone(diffPercent)}`}>
        {benchmark > 0 ? formatPercent(diffPercent) : "-"}
      </div>
    </div>
  );
}

export default function CMASection({
  form,
  selectedListing,
  updateField,
  inputClassName,
  avgHargaPerMeter,
}: Props) {
  const premiumInputClassName = getInputClassName(inputClassName);

  const normalizedRows = useMemo(() => {
    const current = [...(form.cma_entries || [])].slice(0, 10);

    while (current.length < 10) {
      current.push(createEmptyCmaEntry(`fixed-${current.length + 1}`));
    }

    return current;
  }, [form.cma_entries]);

  function updateRowById(id: string, patch: Partial<CmaEntry>) {
    const next = normalizedRows.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
    updateField("cma_entries", next);
  }

  const enrichedRows = useMemo(() => {
    return normalizedRows.map((row, index) => {
      const luas = Number(row.luas_tanah || 0);
      const harga = Number(row.harga || 0);
      const hargaPerMeter = luas > 0 && harga > 0 ? harga / luas : 0;

      return {
        ...row,
        displayNo: index + 1,
        luas,
        harga,
        hargaPerMeter,
        isValid: luas > 0 && harga > 0,
      };
    });
  }, [normalizedRows]);

  const allRowsCompleted =
    enrichedRows.length === 10 && enrichedRows.every((row) => row.isValid);

  const validRows = enrichedRows.filter((row) => row.isValid);

  const sortedDisplayRows = useMemo(() => {
    if (!allRowsCompleted) return enrichedRows;
    return [...enrichedRows].sort((a, b) => a.hargaPerMeter - b.hargaPerMeter);
  }, [enrichedRows, allRowsCompleted]);

  const hargaPerMeterValues = validRows.map((row) => row.hargaPerMeter);

  const marketLowest = hargaPerMeterValues.length
    ? Math.min(...hargaPerMeterValues)
    : 0;

  const marketHighest = hargaPerMeterValues.length
    ? Math.max(...hargaPerMeterValues)
    : 0;

  const subjectLandArea = Number(selectedListing?.luas_tanah ?? 0);

  const totalAkuisisiProperty =
    Number(form.nilai_limit_lelang || 0) +
    Number(form.spare_bidding || 0) +
    Number(form.biaya_balik_nama || 0) +
    Number(form.biaya_eksekusi || 0) +
    Number(form.biaya_renov || 0);

  const acquisitionPerMeter =
    totalAkuisisiProperty > 0 && subjectLandArea > 0
      ? totalAkuisisiProperty / subjectLandArea
      : 0;

  const diffVsLowestPercent =
    acquisitionPerMeter > 0 && marketLowest > 0
      ? ((marketLowest - acquisitionPerMeter) / marketLowest) * 100
      : 0;

  const diffVsAveragePercent =
    acquisitionPerMeter > 0 && avgHargaPerMeter > 0
      ? ((avgHargaPerMeter - acquisitionPerMeter) / avgHargaPerMeter) * 100
      : 0;

  const diffVsHighestPercent =
    acquisitionPerMeter > 0 && marketHighest > 0
      ? ((marketHighest - acquisitionPerMeter) / marketHighest) * 100
      : 0;

  const aiDecision = getDecision(
    acquisitionPerMeter,
    marketLowest,
    avgHargaPerMeter,
    marketHighest,
    allRowsCompleted
  );

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,15,28,0.98),rgba(12,22,40,0.94)_40%,rgba(8,15,28,0.99))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(16,185,129,0.10),transparent_16%),radial-gradient(circle_at_10%_4%,rgba(255,255,255,0.03),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.016),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/[0.04]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              CMA Engine
            </div>

            <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-white sm:text-[24px]">
              Comparative Market Analysis
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Isi 10 komparasi market untuk membaca posisi beli aset terhadap
              harga pasar sekitar secara lebih objektif.
            </p>
          </div>

          <div className="hidden shrink-0 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] lg:block">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Completion
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white">
              {validRows.length}/10 Valid
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
            <div className="mb-4">
              <p className="text-[18px] font-semibold text-white">
                Input Komparasi Market
              </p>
              <p className="mt-1 text-sm text-slate-400">
                10 CMA ditampilkan langsung. Setelah lengkap, sistem otomatis
                mengurutkan dari harga/m² terendah ke tertinggi.
              </p>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-200">
                Property dibeli
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-200">
                LT {subjectLandArea > 0 ? `${formatNumberDots(subjectLandArea)} m²` : "-"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-200">
                Akuisisi {totalAkuisisiProperty > 0 ? formatCurrency(totalAkuisisiProperty) : "-"}
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200">
                {acquisitionPerMeter > 0 ? formatCurrency(acquisitionPerMeter) : "-"} /m²
              </span>
            </div>

            <div className="space-y-3">
              {sortedDisplayRows.map((row, displayIndex) => {
                const isLowest = allRowsCompleted && displayIndex === 0;
                const isHighest =
                  allRowsCompleted && displayIndex === sortedDisplayRows.length - 1;

                return (
                  <div
                    key={row.id}
                    className={`rounded-[22px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition ${
                      isLowest
                        ? "border-emerald-400/30 bg-emerald-500/[0.07] shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
                        : isHighest
                        ? "border-sky-400/30 bg-sky-500/[0.07] shadow-[0_0_0_1px_rgba(59,130,246,0.08)]"
                        : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))]"
                    }`}
                  >
                    <div className="grid gap-3 md:grid-cols-[84px_120px_minmax(300px,1fr)_210px]">
                      <div className="flex h-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-sm font-bold tracking-[0.05em] text-white">
                        CMA {row.displayNo}
                      </div>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberDots(row.luas_tanah)}
                        onChange={(e) =>
                          updateRowById(row.id, {
                            luas_tanah: parseFormattedNumber(e.target.value),
                          })
                        }
                        placeholder="LT"
                        className={premiumInputClassName}
                      />

                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberDots(row.harga)}
                        onChange={(e) =>
                          updateRowById(row.id, {
                            harga: parseFormattedNumber(e.target.value),
                          })
                        }
                        placeholder="Harga jual / harga pasar"
                        className={premiumInputClassName}
                      />

                      <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.03] px-4">
                        <span className="text-sm font-semibold text-white">
                          {row.hargaPerMeter > 0
                            ? formatCurrency(row.hargaPerMeter)
                            : "Harga/m²"}
                        </span>

                        {isLowest ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                            Termurah
                          </span>
                        ) : null}

                        {isHighest ? (
                          <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200">
                            Tertinggi
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-white/8 bg-white/[0.02] px-3 py-3 text-xs text-slate-400">
              <BarChart3 className="h-4 w-4" />
              Fokus utama: masukkan luas tanah dan harga pasar setepat mungkin.
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.016))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[18px] font-semibold text-white">
                  Analyst Summary
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Ringkasan yang tajam, ringkas, dan langsung membantu keputusan beli.
                </p>
              </div>

              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
                Buying Insight
              </span>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-5 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Posisi Harga Masuk
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-7 text-slate-400">
                    Harga masuk per meter dihitung dari total akuisisi dibagi luas tanah subject asset.
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-[32px] font-black tracking-tight text-white sm:text-[38px]">
                    {acquisitionPerMeter > 0 ? formatCurrency(acquisitionPerMeter) : "-"}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                    Harga masuk / m²
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <ComparisonRow
                  label="Perbandingan terhadap CMA termurah"
                  benchmark={marketLowest}
                  benchmarkLabel="Market floor"
                  diffPercent={diffVsLowestPercent}
                />
                <ComparisonRow
                  label="Perbandingan terhadap rata-rata market"
                  benchmark={avgHargaPerMeter}
                  benchmarkLabel="Average market"
                  diffPercent={diffVsAveragePercent}
                />
                <ComparisonRow
                  label="Perbandingan terhadap CMA tertinggi"
                  benchmark={marketHighest}
                  benchmarkLabel="Market ceiling"
                  diffPercent={diffVsHighestPercent}
                />
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.028),rgba(255,255,255,0.015))] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    Keputusan AI
                  </p>
                  <p className="mt-2 text-[22px] font-bold tracking-tight text-white">
                    {aiDecision.label}
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-slate-400">
                    {aiDecision.desc}
                  </p>
                </div>

                <div className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${aiDecision.tone}`}>
                  AI Verdict
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04]">
                  <Bot className="h-4 w-4 text-slate-300" />
                </div>
                <p className="text-sm leading-6 text-slate-300">
                  AI membaca keputusan berdasarkan posisi harga masuk kamu terhadap
                  market floor, rata-rata market, dan market ceiling dari 10 CMA.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-amber-400/15 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-100/90">
              <span className="font-semibold">Catatan analis:</span> fokus utama
              sebelum membeli adalah memastikan harga masuk per meter masih punya
              diskon sehat terhadap market dan tidak mendekati market ceiling.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}