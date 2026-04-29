"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CreditCard,
  Landmark,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

type PaymentProjectData = {
  id: string;
  name: string;
  city?: string | null;
  province?: string | null;
  createdByName?: string | null;
  fundingTarget?: number | null;
  totalFunded?: number | null;
  estimatedNetProfit?: number | null;
};

type PaymentMethod = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "bank_transfer",
    title: "Transfer Bank",
    description: "Cocok untuk nominal besar, verifikasi manual cepat.",
    icon: Landmark,
  },
  {
    id: "virtual_account",
    title: "Virtual Account",
    description: "Praktis, nominal otomatis tercatat saat pembayaran masuk.",
    icon: CreditCard,
  },
  {
    id: "escrow",
    title: "Escrow Project",
    description: "Dana ditahan sementara sampai pembayaran tervalidasi.",
    icon: ShieldCheck,
  },
];

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function buildQuickAmounts(remaining: number) {
  const presets = [5_000_000, 10_000_000, 25_000_000, 50_000_000];
  const filtered = presets.filter((amount) => amount <= remaining);

  if (remaining > 0 && remaining < 5_000_000) {
    return [remaining];
  }

  if (remaining > 0 && remaining <= 100_000_000 && !filtered.includes(remaining)) {
    filtered.push(remaining);
  }

  return Array.from(new Set(filtered)).sort((a, b) => a - b);
}

export default function ButtonShares({
  project,
}: {
  project: PaymentProjectData;
}) {
  const [open, setOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0].id);

  const fundingTarget = Number(project.fundingTarget ?? 0);
  const totalFunded = Number(project.totalFunded ?? 0);
  const estimatedNetProfit = Number(project.estimatedNetProfit ?? 0);

  const remainingFunding = Math.max(fundingTarget - totalFunded, 0);
  const isFullyFunded = remainingFunding <= 0;

  const progress = useMemo(() => {
    if (fundingTarget <= 0) return 0;
    return clampNumber((totalFunded / fundingTarget) * 100, 0, 100);
  }, [fundingTarget, totalFunded]);

  const quickAmounts = useMemo(
    () => buildQuickAmounts(remainingFunding),
    [remainingFunding]
  );

  const minimumAmount = 1_000_000;
  const initialAmount = useMemo(() => {
    if (quickAmounts.length > 0) return quickAmounts[0];
    if (remainingFunding > 0) return Math.min(remainingFunding, 5_000_000);
    return minimumAmount;
  }, [quickAmounts, remainingFunding]);

  const [amount, setAmount] = useState(initialAmount);

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const locationText = [project.city, project.province].filter(Boolean).join(", ");
  const canProceed = !isFullyFunded && amount >= minimumAmount && amount <= remainingFunding;

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-emerald-400/30 bg-[#07131a]/90 text-white shadow-[0_18px_80px_rgba(16,185,129,0.25)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:shadow-[0_24px_90px_rgba(16,185,129,0.35)] sm:h-auto sm:w-auto sm:gap-3 sm:px-4 sm:py-3"
          aria-label="Buka pembayaran project"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.18),transparent_55%)] opacity-90" />
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-300 text-slate-950 shadow-lg shadow-emerald-400/30">
            <Sparkles className="h-5 w-5" />
          </div>

          <div className="relative hidden min-w-0 text-left sm:block">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
              Payment
            </div>
            <div className="mt-0.5 text-sm font-semibold leading-none text-white">
              {isFullyFunded ? "Pendanaan penuh" : "Bayar project"}
            </div>
            <div className="mt-1 text-xs text-slate-300">
              {isFullyFunded
                ? "Lihat ringkasan pendanaan"
                : `Sisa ${formatIDR(remainingFunding)}`}
            </div>
          </div>

          {!isFullyFunded ? (
            <span className="absolute right-2 top-2 hidden h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.95)] sm:block" />
          ) : null}
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-md sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-project-title"
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#071019]/95 text-white shadow-[0_30px_140px_rgba(0,0,0,0.7)] sm:rounded-[32px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />

            <div className="relative flex items-start justify-between border-b border-white/10 px-5 py-5 sm:px-7">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                  <Wallet className="h-3.5 w-3.5" />
                  Pembayaran project
                </div>
                <h2
                  id="payment-project-title"
                  className="text-xl font-semibold tracking-tight sm:text-2xl"
                >
                  Checkout pendanaan
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Modal ini dibuat fokus ke aksi utama: pilih nominal, pilih metode,
                  lalu lanjut ke instruksi pembayaran.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative overflow-y-auto">
              <div className="grid gap-6 px-5 py-5 sm:px-7 sm:py-7 lg:grid-cols-[1.12fr_0.88fr]">
                <div className="space-y-5">
                  <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
                    <div className="border-b border-white/10 px-5 py-4">
                      <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                        Project summary
                      </div>
                    </div>

                    <div className="space-y-5 px-5 py-5">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {project.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-300">
                          {locationText || "Lokasi project belum tersedia"}
                        </div>
                        <div className="mt-2 text-sm text-slate-400">
                          PIC: {project.createdByName || "Tim project"}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-[#0b1620] p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            Target
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {formatIDR(fundingTarget)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#0b1620] p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            Sudah masuk
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {formatIDR(totalFunded)}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 via-transparent to-cyan-400/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-slate-300">
                              Progress pendanaan
                            </div>
                            <div className="mt-1 text-2xl font-semibold text-white">
                              {progress.toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                              Sisa pendanaan
                            </div>
                            <div className="mt-1 text-sm font-semibold text-emerald-200">
                              {formatIDR(remainingFunding)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            Estimasi profit bersih
                          </div>
                          <div className="mt-2 text-base font-semibold text-white">
                            {formatIDR(estimatedNetProfit)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            Status
                          </div>
                          <div className="mt-2 text-base font-semibold text-white">
                            {isFullyFunded ? "Fully funded" : "Open for payment"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                      Nominal pembayaran
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-sm text-slate-300">
                        Masukkan nominal
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={minimumAmount}
                        max={remainingFunding || undefined}
                        value={amount}
                        onChange={(event) => setAmount(Number(event.target.value || 0))}
                        className="h-14 w-full rounded-2xl border border-white/10 bg-[#0b1620] px-4 text-base font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/15"
                        placeholder="Contoh: 10000000"
                        disabled={isFullyFunded}
                      />
                      <div className="mt-2 text-sm text-emerald-200">
                        {formatIDR(amount || 0)}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Minimal pembayaran {formatIDR(minimumAmount)}
                      </div>
                    </div>

                    {quickAmounts.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {quickAmounts.map((quickAmount) => {
                          const active = amount === quickAmount;

                          return (
                            <button
                              key={quickAmount}
                              type="button"
                              onClick={() => setAmount(quickAmount)}
                              disabled={isFullyFunded}
                              className={[
                                "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                                active
                                  ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-100"
                                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                              ].join(" ")}
                            >
                              {quickAmount === remainingFunding
                                ? "Bayar penuh"
                                : formatIDR(quickAmount)}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                      Metode pembayaran
                    </div>

                    <div className="mt-4 space-y-3">
                      {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon;
                        const active = selectedMethod === method.id;

                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setSelectedMethod(method.id)}
                            className={[
                              "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                              active
                                ? "border-emerald-300/40 bg-emerald-300/10"
                                : "border-white/10 bg-[#0b1620] hover:bg-white/[0.04]",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                                active
                                  ? "bg-gradient-to-br from-emerald-300 to-cyan-300 text-slate-950"
                                  : "bg-white/[0.05] text-slate-300",
                              ].join(" ")}
                            >
                              <Icon className="h-5 w-5" />
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-white">
                                {method.title}
                              </div>
                              <div className="mt-1 text-sm text-slate-400">
                                {method.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-amber-300/15 bg-amber-300/10 p-5">
                    <div className="text-sm font-semibold text-amber-100">
                      Catatan UX
                    </div>
                    <div className="mt-2 text-sm leading-6 text-amber-50/80">
                      Setelah tombol utama ditekan, tahap berikutnya paling ideal
                      adalah menampilkan instruksi transfer / nomor VA / upload bukti
                      bayar. Jadi UI ini sudah siap dipasang ke flow backend Anda.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex flex-col gap-3 border-t border-white/10 bg-[#060d14]/90 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="text-sm text-slate-400">
                {isFullyFunded
                  ? "Target pendanaan project ini sudah terpenuhi."
                  : `Nominal yang akan dibayar: ${formatIDR(amount || 0)}`}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                >
                  Nanti saja
                </button>

                <button
                  type="button"
                  disabled={!canProceed}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Lanjut ke pembayaran
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}