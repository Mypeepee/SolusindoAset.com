"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type { WalletKey, WalletSummary } from "../types";

type FormErrors = Partial<
  Record<"wallet" | "nominal" | "judul" | "tanggal", string>
>;

type CashflowQuickFormProps = {
  idProject: string;
  wallets: WalletSummary[];
  defaultWallet?: WalletKey;
  onSubmitted?: () => void;
  onPendingChange?: (pending: boolean) => void;
  submitUrl?: string;
  formId?: string;
};

const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}

function parseIsoDate(value?: string | null) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

function formatDateDisplay(value?: string | null) {
  const date = parseIsoDate(value);
  if (!date) return "Pilih tanggal";

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDatePretty(value?: string | null) {
  const date = parseIsoDate(value);
  if (!date) return "-";

  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function isSameDate(a: Date | null, b: Date | null) {
  if (!a || !b) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDigitsId(value: string) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return new Intl.NumberFormat("id-ID").format(numeric);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function getWalletHint(walletKey?: string) {
  switch (walletKey) {
    case "utama":
      return "Biaya inti proyek";
    case "dokumen":
      return "Legal & administrasi";
    case "eksekusi":
      return "Operasional lapangan";
    case "renovasi":
      return "Perbaikan & finishing";
    case "cadangan":
      return "Buffer pengeluaran";
    default:
      return "Dompet proyek";
  }
}

function getWalletTone(walletKey?: string) {
  switch (walletKey) {
    case "utama":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
    case "dokumen":
      return "border-cyan-300/20 bg-cyan-400/10 text-cyan-200";
    case "eksekusi":
      return "border-amber-300/20 bg-amber-400/10 text-amber-200";
    case "renovasi":
      return "border-violet-300/20 bg-violet-400/10 text-violet-200";
    case "cadangan":
      return "border-rose-300/20 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/[0.05] text-white/70";
  }
}

function buildErrors(params: {
  wallet?: WalletKey;
  nominal: number;
  judul: string;
  tanggal: string;
}) {
  const errors: FormErrors = {};

  if (!params.wallet) {
    errors.wallet = "Pilih dompet terlebih dahulu.";
  }

  if (!Number.isFinite(params.nominal) || params.nominal <= 0) {
    errors.nominal = "Masukkan nominal yang valid.";
  }

  if (!params.judul.trim()) {
    errors.judul = "Judul transaksi wajib diisi.";
  }

  if (!params.tanggal) {
    errors.tanggal = "Tanggal transaksi wajib diisi.";
  }

  return errors;
}

function getMonthMatrix(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekDay = (firstDayOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startWeekDay);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );

    return {
      date,
      inCurrentMonth: date.getMonth() === month,
    };
  });
}

function CalendarPickerModal({
  open,
  value,
  disabled,
  onClose,
  onChange,
}: {
  open: boolean;
  value: string;
  disabled?: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const selectedDate = parseIsoDate(value);
  const today = parseIsoDate(todayIso()) ?? new Date();

  const [viewDate, setViewDate] = useState<Date>(selectedDate ?? today);

  useEffect(() => {
    if (!open) return;
    setViewDate(selectedDate ?? today);
    // jangan masukkan selectedDate/today ke dependency
    // karena itu bikin viewDate ke-reset terus saat klik prev/next month
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const cells = getMonthMatrix(viewDate);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020817]/80 px-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.12),transparent_42%),linear-gradient(180deg,rgba(10,18,30,0.98),rgba(3,8,18,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">
              Pilih tanggal
            </div>
            <div className="mt-1 text-sm text-white/78">
              {formatDatePretty(value)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)
                )
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.08]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center">
              <div className="text-base font-semibold text-white">
                {MONTH_LABELS[viewDate.getMonth()]}
              </div>
              <div className="text-sm text-slate-400">
                {viewDate.getFullYear()}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
                )
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.08]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="pb-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/32"
              >
                {label}
              </div>
            ))}

            {cells.map(({ date, inCurrentMonth }) => {
              const isSelected = isSameDate(date, selectedDate);
              const isToday = isSameDate(date, today);

              return (
                <button
                  key={toIsoDate(date)}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(toIsoDate(date));
                    onClose();
                  }}
                  className={[
                    "relative aspect-square rounded-2xl border text-sm font-medium transition",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    isSelected
                      ? "border-cyan-300/45 bg-cyan-400/[0.16] text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12)_inset]"
                      : isToday
                        ? "border-violet-300/25 bg-violet-400/[0.10] text-white/92"
                        : inCurrentMonth
                          ? "border-white/8 bg-white/[0.03] text-white/80 hover:border-cyan-300/20 hover:bg-cyan-400/[0.06]"
                          : "border-transparent bg-transparent text-white/22 hover:border-white/8 hover:bg-white/[0.02]",
                  ].join(" ")}
                >
                  {date.getDate()}
                  {isToday && !isSelected ? (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-300" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso());
                onClose();
              }}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/78 transition hover:bg-white/[0.07] hover:text-white"
            >
              Hari ini
            </button>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                Tanggal terpilih
              </div>
              <div className="mt-1 text-sm font-medium text-white/88">
                {formatDatePretty(value)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CashflowQuickForm({
  idProject,
  wallets,
  defaultWallet,
  onSubmitted,
  onPendingChange,
  submitUrl,
  formId = "cashflow-entry-form",
}: CashflowQuickFormProps) {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [walletKey, setWalletKey] = useState<WalletKey>(
    defaultWallet ?? wallets?.[0]?.walletKey ?? "utama"
  );
  const [nominalInput, setNominalInput] = useState("");
  const [judulTransaksi, setJudulTransaksi] = useState("");
  const [tanggalTransaksi, setTanggalTransaksi] = useState(todayIso());
  const [catatan, setCatatan] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    onPendingChange?.(isSubmitting);
  }, [isSubmitting, onPendingChange]);

  const nominalValue = useMemo(
    () => Number(onlyDigits(nominalInput) || 0),
    [nominalInput]
  );

  const selectedWallet =
    wallets.find((item) => item.walletKey === walletKey) ?? wallets?.[0];

  const currentBalance = Number(selectedWallet?.balance ?? 0);
  const remainingBalance = currentBalance - nominalValue;

  const sectionClass =
    "rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5";

  function resetForm() {
    if (isSubmitting) return;

    setWalletKey(defaultWallet ?? wallets?.[0]?.walletKey ?? "utama");
    setNominalInput("");
    setJudulTransaksi("");
    setTanggalTransaksi(todayIso());
    setCatatan("");
    setErrors({});
    setServerError("");
    setSuccessMessage("");
  }

  function handleNominalChange(value: string) {
    setNominalInput(onlyDigits(value));
    setErrors((prev) => ({ ...prev, nominal: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setServerError("");
    setSuccessMessage("");

    const nextErrors = buildErrors({
      wallet: walletKey,
      nominal: nominalValue,
      judul: judulTransaksi,
      tanggal: tanggalTransaksi,
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!submitUrl) {
      setServerError(
        "Form sudah siap dipakai, tapi endpoint submit belum dihubungkan."
      );
      return;
    }

    const payload = {
      id_project: idProject,
      wallet_key: walletKey,
      jenis_transaksi: "pengeluaran",
      nominal: nominalValue,
      judul_transaksi: judulTransaksi.trim(),
      tanggal_transaksi: tanggalTransaksi,
      catatan: catatan.trim() || null,
      status_transaksi: "tercatat",
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let responseJson: { message?: string } | null = null;
      try {
        responseJson = await response.json();
      } catch {
        responseJson = null;
      }

      if (!response.ok) {
        throw new Error(
          responseJson?.message || "Gagal menyimpan transaksi."
        );
      }

      setSuccessMessage("Transaksi berhasil dicatat.");
      setNominalInput("");
      setJudulTransaksi("");
      setCatatan("");
      setErrors({});
      setServerError("");

      router.refresh();
      onSubmitted?.();
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan transaksi."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form
        id={formId}
        onSubmit={handleSubmit}
        onReset={(event) => {
          event.preventDefault();
          resetForm();
        }}
        className="space-y-5"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
          <div className="space-y-5">
            <section className={sectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                  Nominal pengeluaran
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-rose-200">
                  Keluar
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-[#07111d] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
                <label className="block">
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-semibold text-white/90 sm:text-2xl">
                      Rp
                    </div>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      value={formatDigitsId(nominalInput)}
                      onChange={(e) => handleNominalChange(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full bg-transparent text-3xl font-semibold tracking-tight text-white outline-none placeholder:text-white/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-4xl"
                    />
                  </div>
                </label>

                <div className="mt-3 text-sm leading-6 text-slate-400">
                  {nominalValue > 0
                    ? `Pengeluaran akan dicatat sebesar ${formatCurrency(
                        nominalValue
                      )}.`
                    : "Masukkan nominal transaksi."}
                </div>
              </div>

              {errors.nominal ? (
                <div className="mt-3 text-sm text-rose-300">
                  {errors.nominal}
                </div>
              ) : null}
            </section>

            <section className="grid gap-5">
              <div className={sectionClass}>
                <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                  Judul transaksi
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bayar tukang renovasi"
                  value={judulTransaksi}
                  onChange={(e) => {
                    setJudulTransaksi(e.target.value);
                    setErrors((prev) => ({ ...prev, judul: undefined }));
                  }}
                  disabled={isSubmitting}
                  className="mt-3 h-16 w-full rounded-[20px] border border-white/10 bg-white/[0.03] px-5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60 md:text-lg xl:text-[1.15rem]"
                />
                {errors.judul ? (
                  <div className="mt-2 text-sm text-rose-300">
                    {errors.judul}
                  </div>
                ) : null}
              </div>

              <div className={sectionClass}>
                <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                  Tanggal
                </label>

                <button
                  type="button"
                  onClick={() => !isSubmitting && setIsCalendarOpen(true)}
                  disabled={isSubmitting}
                  className="mt-3 flex h-16 w-full items-center justify-between rounded-[20px] border border-cyan-300/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))] px-4 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-cyan-300/45 hover:bg-cyan-400/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-3">
                    <CalendarDays className="h-5 w-5 text-white/55" />
                    <span className="text-base font-medium tracking-[0.02em] text-white md:text-lg">
                      {formatDateDisplay(tanggalTransaksi)}
                    </span>
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
                    Ubah
                  </span>
                </button>

                {errors.tanggal ? (
                  <div className="mt-2 text-sm text-rose-300">
                    {errors.tanggal}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-400">
                    Ketuk untuk memilih tanggal transaksi.
                  </div>
                )}
              </div>
            </section>

            <section className={sectionClass}>
              <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                Catatan
              </label>
              <textarea
                rows={4}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                disabled={isSubmitting}
                placeholder="Tambahkan konteks singkat agar histori transaksi lebih mudah dipahami."
                className="mt-3 w-full rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </section>
          </div>

          <div className="space-y-5">
            <section className={sectionClass}>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                Pilih dompet
              </div>

              <div className="mt-3 grid gap-3">
                {wallets.map((option) => {
                  const active = walletKey === option.walletKey;

                  return (
                    <button
                      key={option.walletKey}
                      type="button"
                      onClick={() => {
                        if (isSubmitting) return;
                        setWalletKey(option.walletKey);
                        setErrors((prev) => ({ ...prev, wallet: undefined }));
                      }}
                      disabled={isSubmitting}
                      className={[
                        "rounded-[22px] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                        active
                          ? "border-cyan-300/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.10),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={[
                              "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em]",
                              getWalletTone(option.walletKey),
                            ].join(" ")}
                          >
                            {option.title}
                          </div>

                          <div className="mt-2 text-base text-slate-300">
                            {getWalletHint(option.walletKey)}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                            Saldo
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white/90">
                            {formatCurrency(Number(option.balance ?? 0))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {errors.wallet ? (
                <div className="mt-3 text-sm text-rose-300">{errors.wallet}</div>
              ) : null}
            </section>

            <section className={sectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                    Sisa saldo dompet
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Ringkasan dari dompet yang sedang dipilih
                  </div>
                </div>

                <div
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em]",
                    getWalletTone(selectedWallet?.walletKey),
                  ].join(" ")}
                >
                  {selectedWallet?.title ?? "Dompet"}
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-sm text-slate-400">Saldo saat ini</span>
                  <span className="text-sm font-medium text-white/90">
                    {formatCurrency(currentBalance)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-white/8 py-2">
                  <span className="text-sm text-slate-400">Transaksi ini</span>
                  <span className="text-sm font-medium text-rose-200">
                    {nominalValue > 0 ? formatCurrency(nominalValue) : "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-white/8 py-2">
                  <span className="text-sm text-slate-300">Sisa saldo</span>
                  <span
                    className={[
                      "text-sm font-semibold",
                      remainingBalance < 0 ? "text-rose-200" : "text-white",
                    ].join(" ")}
                  >
                    {formatCurrency(remainingBalance)}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {serverError ? (
          <div className="rounded-[18px] border border-rose-300/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {serverError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-[18px] border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {successMessage}
            </div>
          </div>
        ) : null}
      </form>

      <CalendarPickerModal
        open={isCalendarOpen}
        value={tanggalTransaksi}
        disabled={isSubmitting}
        onClose={() => setIsCalendarOpen(false)}
        onChange={(value) => {
          setTanggalTransaksi(value);
          setErrors((prev) => ({ ...prev, tanggal: undefined }));
        }}
      />
    </>
  );
}