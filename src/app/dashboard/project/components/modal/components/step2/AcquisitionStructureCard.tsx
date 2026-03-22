"use client";

import {
  FileText,
  Gavel,
  Hammer,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { CreateProjectFormValues, ListingOption } from "../../types";
import Field from "../common/Field";
import {
  formatCurrency,
  formatNumberDots,
  getBiayaBalikNamaBreakdown,
  parseFormattedNumber,
} from "../../utils";

type Props = {
  form: CreateProjectFormValues;
  selectedListing?: ListingOption | null;
  isLelang: boolean;
  listingBasisValue: number;
  sourceLabel: string;
  biayaBalikNamaComputed: number;
  updateField: <K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) => void;
  inputClassName: string;
};

function getInputClassName(baseClassName: string) {
  return `${baseClassName} h-14 rounded-[20px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-slate-500`;
}

function SummaryRow({
  icon: Icon,
  label,
  helper,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  helper: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04]">
            <Icon className="h-4 w-4 text-slate-300" />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-sm text-slate-400">{helper}</p>
          </div>
        </div>

        <p className="shrink-0 text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

export default function AcquisitionStructureCard({
  form,
  isLelang,
  listingBasisValue,
  sourceLabel,
  biayaBalikNamaComputed: _biayaBalikNamaComputed,
  updateField,
  inputClassName,
}: Props) {
  const premiumInputClassName = getInputClassName(inputClassName);

  const nilaiLimitLelang = Number(form.nilai_limit_lelang || 0);
  const spareBidding = Number(form.spare_bidding || 0);

  const hargaMenangLelang = nilaiLimitLelang + spareBidding;

  // IMPORTANT:
  // biaya balik nama dihitung dari nilai_limit_lelang saja
  // BUKAN dari hargaMenangLelang
  const biayaBalikNamaBreakdown =
    getBiayaBalikNamaBreakdown(nilaiLimitLelang);

  const biayaBeaLelang = Number(biayaBalikNamaBreakdown.bea_lelang || 0);
  const biayaBphtb = Number(biayaBalikNamaBreakdown.bphtb || 0);
  const biayaPpnLelang = Number(biayaBalikNamaBreakdown.ppn_lelang || 0);
  const biayaBalikNamaAdmin = Number(
    biayaBalikNamaBreakdown.balik_nama || 0
  );
  const biayaRoya = Number(biayaBalikNamaBreakdown.roya || 0);

  const biayaBalikNamaFinal =
    biayaBeaLelang +
    biayaBphtb +
    biayaPpnLelang +
    biayaBalikNamaAdmin +
    biayaRoya;

  const totalAkuisisiProperty =
    nilaiLimitLelang +
    spareBidding +
    biayaBalikNamaFinal +
    Number(form.biaya_eksekusi || 0) +
    Number(form.biaya_renov || 0);

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,15,28,0.98),rgba(12,22,40,0.94)_40%,rgba(8,15,28,0.99))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.12),transparent_16%),radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.035),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/[0.04]" />
      <div className="pointer-events-none absolute -right-8 top-4 h-24 w-24 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute left-10 top-0 h-16 w-16 rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Acquisition Setup
            </div>

            <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-white sm:text-[24px]">
              Nilai Property & Struktur Biaya
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Nilai dasar property mengikuti listing terpilih, lalu biaya masuk
              project diringkas otomatis dalam format yang cepat dibaca.
            </p>
          </div>

          <div className="hidden shrink-0 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-5 py-4 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] lg:block">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Source
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white">
              {sourceLabel}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[18px] font-semibold text-white">
                  Basis Nilai Property
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Semua nilai inti project dikelola dari sini.
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-slate-200">
                {formatCurrency(listingBasisValue)}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={isLelang ? "Nilai Limit Lelang" : "Nilai Dasar Property"}
                icon={Wallet}
                helper={
                  isLelang
                    ? "Mengikuti nilai limit lelang dari property."
                    : "Mengikuti harga promo jika ada, jika tidak harga jual."
                }
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(form.nilai_limit_lelang)}
                  onChange={(e) =>
                    updateField(
                      "nilai_limit_lelang",
                      parseFormattedNumber(e.target.value)
                    )
                  }
                  placeholder="0"
                  className={premiumInputClassName}
                />
              </Field>

              <Field
                label="Spare Bidding"
                icon={Gavel}
                helper={
                  isLelang
                    ? "Cadangan bidding di atas limit lelang."
                    : "Default 0 untuk non-lelang."
                }
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(form.spare_bidding)}
                  onChange={(e) =>
                    updateField(
                      "spare_bidding",
                      parseFormattedNumber(e.target.value)
                    )
                  }
                  placeholder="0"
                  className={premiumInputClassName}
                />
              </Field>

              <Field
                label="Biaya Balik Nama"
                icon={ShieldCheck}
                helper="Otomatis dihitung dari nilai limit lelang: 8,2% + roya Rp75.000."
              >
                <input
                  type="text"
                  value={formatCurrency(biayaBalikNamaFinal)}
                  readOnly
                  className={`${premiumInputClassName} cursor-not-allowed opacity-95`}
                />
              </Field>

              <Field
                label="Biaya Eksekusi"
                icon={FileText}
                helper="Operasional, lapangan, dan kebutuhan eksekusi."
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberDots(form.biaya_eksekusi)}
                  onChange={(e) =>
                    updateField(
                      "biaya_eksekusi",
                      parseFormattedNumber(e.target.value)
                    )
                  }
                  placeholder="0"
                  className={premiumInputClassName}
                />
              </Field>

              <div className="md:col-span-2">
                <Field
                  label="Biaya Renov"
                  icon={Hammer}
                  helper="Perapihan, renovasi ringan, atau pekerjaan lanjutan."
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberDots(form.biaya_renov)}
                    onChange={(e) =>
                      updateField(
                        "biaya_renov",
                        parseFormattedNumber(e.target.value)
                      )
                    }
                    placeholder="0"
                    className={premiumInputClassName}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.016))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[18px] font-semibold text-white">
                  Biaya Masuk Project
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Ringkasan acquisition yang rapat dan mudah dipindai.
                </p>
              </div>

              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
                Compact View
              </span>
            </div>

            <div className="space-y-3">
              <SummaryRow
                icon={Wallet}
                label="Harga Menang Lelang"
                helper="Nilai limit lelang + spare bidding"
                value={formatCurrency(hargaMenangLelang)}
              />

              <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.032),rgba(255,255,255,0.016))] px-4 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04]">
                      <ReceiptText className="h-4 w-4 text-slate-300" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Biaya Balik Nama
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Dihitung dari nilai limit lelang saja: 8,2% + roya flat Rp75.000
                      </p>
                    </div>
                  </div>

                  <p className="shrink-0 text-lg font-bold text-white">
                    {formatCurrency(biayaBalikNamaFinal)}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-[14px] border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Bea Lelang 2%
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrency(biayaBeaLelang)}
                    </p>
                  </div>

                  <div className="rounded-[14px] border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      BPHTB 5%
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrency(biayaBphtb)}
                    </p>
                  </div>

                  <div className="rounded-[14px] border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      PPN Lelang 1,1%
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrency(biayaPpnLelang)}
                    </p>
                  </div>

                  <div className="rounded-[14px] border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Roya Flat
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrency(biayaRoya)}
                    </p>
                  </div>

                  <div className="col-span-2 rounded-[14px] border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Balik Nama 0,1%
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrency(biayaBalikNamaAdmin)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 rounded-[28px] border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.09),rgba(16,185,129,0.03)_45%,rgba(255,255,255,0.02))] px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">
                    Total Akuisisi Property
                  </p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-100/80">
                    Nilai limit lelang + spare bidding + biaya balik nama + biaya eksekusi +
                    biaya renov.
                  </p>
                </div>

                <p className="text-[30px] font-black tracking-tight text-white sm:text-[36px]">
                  {formatCurrency(totalAkuisisiProperty)}
                </p>
              </div>

              <div className="h-px w-full bg-white/10" />

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-slate-300">
                  <span className="text-slate-500">Property</span>{" "}
                  <span className="font-semibold text-white">
                    {formatCurrency(nilaiLimitLelang)}
                  </span>
                </span>

                <span className="text-slate-300">
                  <span className="text-slate-500">Spare</span>{" "}
                  <span className="font-semibold text-white">
                    {formatCurrency(spareBidding)}
                  </span>
                </span>

                <span className="text-slate-300">
                  <span className="text-slate-500">Balik Nama</span>{" "}
                  <span className="font-semibold text-white">
                    {formatCurrency(biayaBalikNamaFinal)}
                  </span>
                </span>

                <span className="text-slate-300">
                  <span className="text-slate-500">Eksekusi</span>{" "}
                  <span className="font-semibold text-white">
                    {formatCurrency(form.biaya_eksekusi)}
                  </span>
                </span>

                <span className="text-slate-300">
                  <span className="text-slate-500">Renov</span>{" "}
                  <span className="font-semibold text-white">
                    {formatCurrency(form.biaya_renov)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}