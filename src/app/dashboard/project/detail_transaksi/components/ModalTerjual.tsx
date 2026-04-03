"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Percent,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

type Investor = {
  id_agent?: string;
  nama?: string;
  avatar?: string | null;
  gambar?: string | null;
  foto?: string | null;
  image?: string | null;
  nominal_komitmen?: number | string;
  persentase_kepemilikan?: number | string;
};

type ProjectData = {
  id_project?: string;
  nama_project?: string;
  investors?: Investor[];
  total_biaya_akuisisi?: number | string;
  estimasi_harga_jual?: number | string;
  mulai_tanggal?: string | null;

  tanggal_terjual?: string | null;
  harga_jual?: number | string;
  pph_percent?: number | string;
  ajb_percent?: number | string;
  agent_fee_percent?: number | string;
  total_biaya_transaksi?: number | string;
  profit_kotor?: number | string;
  profit_bersih?: number | string;
  roi_kotor_percent?: number | string;
  roi_bersih_percent?: number | string;
};

type SubmitPayload = {
  id_project?: string;
  tanggal_terjual: string | null;
  durasi_hari: number;
  durasi_bulan: number;
  roi_kotor_percent: number;
  roi_bersih_percent: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  pph_nominal: number;
  ajb_nominal: number;
  agent_fee_nominal: number;
  total_biaya_transaksi: number;
  profit_kotor: number;
  profit_bersih: number;
  distribusi_investor: Array<{
    id_agent: string;
    nama: string;
    modal: number;
    porsi_percent: number;
    profit: number;
    total_diterima: number;
  }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  project: ProjectData;
  onSubmit?: (payload: SubmitPayload) => Promise<void> | void;
  readOnly?: boolean;
};

function toSafeNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3,})/g, "")
      .replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    const asString =
      typeof (value as any).toString === "function"
        ? (value as any).toString()
        : "";
    const parsed = Number(asString);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatIDR(value: unknown) {
  const num = toSafeNumber(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function parseFormattedNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function toInputCurrency(value: number) {
  if (!value) return "";
  return value.toLocaleString("id-ID");
}

function normalizePercent(raw: unknown): number {
  const num = toSafeNumber(raw);
  if (num <= 0) return 0;
  return num > 1 ? num / 100 : num;
}

function getInvestorAvatar(inv: Investor) {
  return inv?.avatar ?? inv?.gambar ?? inv?.foto ?? inv?.image ?? null;
}

function getInitials(name: string) {
  const clean = String(name || "").trim();
  if (!clean) return "IN";

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeDateInput(value?: string | null) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value?: string | null) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;
  const [y, m, d] = normalized.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(value?: string | null) {
  const date = parseLocalDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function diffDays(start?: string | null, end?: string | null) {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  if (!startDate || !endDate) return 0;

  const ms = endDate.getTime() - startDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatDurationDetailed(daysTotal: number) {
  const safeDays = Math.max(0, daysTotal);
  const months = Math.floor(safeDays / 30);
  const days = safeDays % 30;

  if (months > 0 && days > 0) return `${months} bulan ${days} hari`;
  if (months > 0) return `${months} bulan`;
  if (days > 0) return `${days} hari`;
  return "-";
}

function buildCalendarDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

function CalendarPicker({
  value,
  minDate,
  onChange,
  disabled = false,
}: {
  value: string;
  minDate?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = parseLocalDate(value) ?? new Date();
  const minDateObj = parseLocalDate(minDate);
  const [viewDate, setViewDate] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    const base = parseLocalDate(value);
    if (!base) return;
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [value]);

  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate]);

  const today = toYmd(new Date());
  const selectedYmd = normalizeDateInput(value);
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const weekLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={`group w-full rounded-[22px] border px-4 py-3 text-left transition ${
          disabled
            ? "cursor-default border-white/8 bg-slate-950/25 opacity-90"
            : "border-white/10 bg-slate-950/50 hover:bg-slate-950 focus:border-emerald-400/40"
        }`}
      >
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Tanggal realisasi penjualan
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-300">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-semibold text-white">
                {formatDisplayDate(value)}
              </div>
              <div className="text-xs text-slate-400">
                {disabled ? "Tanggal realisasi tersimpan" : "Pilih tanggal penjualan"}
              </div>
            </div>
          </div>

          {!disabled ? (
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
              Ubah
            </div>
          ) : null}
        </div>
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 top-[calc(100%+12px)] z-[120] w-full min-w-[300px] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,11,17,0.98),rgba(4,6,10,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/70 via-white/20 to-transparent" />
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-300/10 blur-3xl" />

          <div className="relative p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setViewDate(new Date(currentYear, currentMonth - 1, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.08]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-center">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Kalender
                </div>
                <div className="mt-1 text-base font-semibold text-white">
                  {formatMonthYear(viewDate)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewDate(new Date(currentYear, currentMonth + 1, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.08]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-7 gap-2">
              {weekLabels.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {days.map((date) => {
                const ymd = toYmd(date);
                const isCurrentMonth = date.getMonth() === currentMonth;
                const isSelected = ymd === selectedYmd;
                const isToday = ymd === today;
                const isDisabled = !!minDateObj && date < minDateObj;

                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onChange(ymd);
                      setOpen(false);
                    }}
                    className={[
                      "relative flex h-11 items-center justify-center rounded-2xl text-sm font-medium transition",
                      isSelected
                        ? "border border-emerald-300/20 bg-emerald-400/15 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                        : isCurrentMonth
                        ? "border border-transparent bg-white/[0.03] text-white hover:border-white/10 hover:bg-white/[0.07]"
                        : "border border-transparent bg-transparent text-slate-600 hover:bg-white/[0.03]",
                      isDisabled
                        ? "cursor-not-allowed opacity-35 hover:bg-transparent"
                        : "",
                    ].join(" ")}
                  >
                    <span>{date.getDate()}</span>
                    {isToday && !isSelected ? (
                      <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-cyan-300" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Tanggal dipilih
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {formatDisplayDate(value)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onChange(toYmd(new Date()));
                  setOpen(false);
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
              >
                Hari ini
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "default",
  helper,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning" | "negative" | "cyan";
  helper?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "warning"
      ? "text-amber-300"
      : tone === "negative"
      ? "text-rose-300"
      : tone === "cyan"
      ? "text-cyan-300"
      : "text-white";

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-[28px] font-semibold leading-none ${toneClass}`}>
        {value}
      </div>
      {helper ? (
        <div className="mt-2 text-xs leading-5 text-slate-400">{helper}</div>
      ) : null}
    </div>
  );
}

export default function ModalTerjual({
  open,
  onClose,
  project,
  onSubmit,
  readOnly = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [hargaJualInput, setHargaJualInput] = useState("");
  const [totalBiayaAkuisisiInput, setTotalBiayaAkuisisiInput] = useState("");
  const [tanggalTerjual, setTanggalTerjual] = useState("");

  const [pphInput, setPphInput] = useState("2.5");
  const [ajbInput, setAjbInput] = useState("0.5");
  const [agentFeeInput, setAgentFeeInput] = useState("2");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const hargaJualValue = readOnly
      ? toSafeNumber(project?.harga_jual ?? project?.estimasi_harga_jual)
      : toSafeNumber(project?.estimasi_harga_jual);

    const biayaAkuisisiValue = toSafeNumber(project?.total_biaya_akuisisi);
    const tanggalReal = normalizeDateInput(
      readOnly ? project?.tanggal_terjual : null
    );

    setHargaJualInput(toInputCurrency(hargaJualValue));
    setTotalBiayaAkuisisiInput(toInputCurrency(biayaAkuisisiValue));
    setTanggalTerjual(tanggalReal || new Date().toISOString().slice(0, 10));

    setPphInput(String(toSafeNumber(project?.pph_percent || 2.5)));
    setAjbInput(String(toSafeNumber(project?.ajb_percent || 0.5)));
    setAgentFeeInput(String(toSafeNumber(project?.agent_fee_percent || 2)));

    setIsSaving(false);
  }, [open, project, readOnly]);

  useEffect(() => {
    if (!open) return;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [open]);

  const mulaiTanggal = useMemo(
    () => normalizeDateInput(project?.mulai_tanggal),
    [project?.mulai_tanggal]
  );

  const hargaJual = useMemo(
    () => parseFormattedNumber(hargaJualInput),
    [hargaJualInput]
  );

  const totalBiayaAkuisisi = useMemo(
    () => parseFormattedNumber(totalBiayaAkuisisiInput),
    [totalBiayaAkuisisiInput]
  );

  const pph = useMemo(() => toSafeNumber(pphInput), [pphInput]);
  const ajb = useMemo(() => toSafeNumber(ajbInput), [ajbInput]);
  const agentFee = useMemo(() => toSafeNumber(agentFeeInput), [agentFeeInput]);

  const pphNominal = useMemo(() => hargaJual * (pph / 100), [hargaJual, pph]);
  const ajbNominal = useMemo(() => hargaJual * (ajb / 100), [hargaJual, ajb]);
  const agentFeeNominal = useMemo(
    () => hargaJual * (agentFee / 100),
    [hargaJual, agentFee]
  );

  const totalBiayaTransaksi = pphNominal + ajbNominal + agentFeeNominal;
  const profitKotor = hargaJual - totalBiayaAkuisisi;
  const profitBersih = profitKotor - totalBiayaTransaksi;

  const durasiHari = useMemo(
    () => diffDays(mulaiTanggal, tanggalTerjual),
    [mulaiTanggal, tanggalTerjual]
  );

  const durasiBulan = useMemo(() => {
    if (durasiHari <= 0) return 0;
    return Number((durasiHari / 30).toFixed(1));
  }, [durasiHari]);

  const durasiLabel = useMemo(
    () => formatDurationDetailed(durasiHari),
    [durasiHari]
  );

  const roiKotor = useMemo(() => {
    if (totalBiayaAkuisisi <= 0) return 0;
    return (profitKotor / totalBiayaAkuisisi) * 100;
  }, [profitKotor, totalBiayaAkuisisi]);

  const roiBersih = useMemo(() => {
    if (totalBiayaAkuisisi <= 0) return 0;
    return (profitBersih / totalBiayaAkuisisi) * 100;
  }, [profitBersih, totalBiayaAkuisisi]);

  const invalidTanggal =
    !!mulaiTanggal &&
    !!tanggalTerjual &&
    diffDays(mulaiTanggal, tanggalTerjual) < 0;

  const investors = Array.isArray(project?.investors) ? project.investors : [];

  const distributions = useMemo(() => {
    if (!investors.length) return [];

    const investorBase = investors
      .map((inv, index) => {
        const modal = toSafeNumber(inv?.nominal_komitmen);
        const percentRaw = normalizePercent(inv?.persentase_kepemilikan);
        const id_agent = String(inv?.id_agent ?? "").trim();

        return {
          id_agent,
          nama: inv?.nama ?? id_agent ?? `Investor ${index + 1}`,
          avatar: getInvestorAvatar(inv),
          modal,
          percentRaw,
        };
      })
      .filter((item) => item.id_agent.length > 0);

    if (!investorBase.length) return [];

    const totalExplicitPercent = investorBase.reduce(
      (sum, item) => sum + item.percentRaw,
      0
    );

    const totalModal = investorBase.reduce((sum, item) => sum + item.modal, 0);

    const finalWeights = investorBase.map((item) => {
      let weight = 0;

      if (totalExplicitPercent > 0) {
        weight = item.percentRaw / totalExplicitPercent;
      } else if (totalModal > 0) {
        weight = item.modal / totalModal;
      }

      return {
        ...item,
        weight,
      };
    });

    return finalWeights.map((item) => {
      const profit = profitBersih * item.weight;
      const totalDiterima = item.modal + profit;

      return {
        id_agent: item.id_agent,
        nama: item.nama,
        avatar: item.avatar,
        modal: item.modal,
        porsiPercent: item.weight * 100,
        profit,
        totalDiterima,
      };
    });
  }, [investors, profitBersih]);

  const totalDistribusiPercent = distributions.reduce(
    (sum, item) => sum + item.porsiPercent,
    0
  );

  const totalDistribusiProfit = distributions.reduce(
    (sum, item) => sum + item.profit,
    0
  );

  async function submitToApi(payload: SubmitPayload) {
    const projectId = payload.id_project || project?.id_project;

    if (!projectId) {
      throw new Error("ID project tidak ditemukan.");
    }

    const res = await fetch(`/api/project/${projectId}/simpan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.message || "Gagal menyimpan penjualan.");
    }

    return json;
  }

  async function handleSubmit() {
    if (readOnly || invalidTanggal || isSaving) return;

    const payload: SubmitPayload = {
      id_project: project?.id_project,
      tanggal_terjual: tanggalTerjual || null,
      durasi_hari: durasiHari,
      durasi_bulan: durasiBulan,
      roi_kotor_percent: roiKotor,
      roi_bersih_percent: roiBersih,
      harga_jual: hargaJual,
      total_biaya_akuisisi: totalBiayaAkuisisi,
      pph_percent: pph,
      ajb_percent: ajb,
      agent_fee_percent: agentFee,
      pph_nominal: pphNominal,
      ajb_nominal: ajbNominal,
      agent_fee_nominal: agentFeeNominal,
      total_biaya_transaksi: totalBiayaTransaksi,
      profit_kotor: profitKotor,
      profit_bersih: profitBersih,
      distribusi_investor: distributions.map((item) => ({
        id_agent: item.id_agent,
        nama: item.nama,
        modal: item.modal,
        porsi_percent: item.porsiPercent,
        profit: item.profit,
        total_diterima: item.totalDiterima,
      })),
    };

    try {
      setIsSaving(true);

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        await submitToApi(payload);
      }

      onClose();
    } catch (error) {
      console.error("Gagal menyimpan penjualan:", error);
      alert(error instanceof Error ? error.message : "Gagal menyimpan penjualan.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!mounted || !open) return null;

  const isProfitPositive = profitBersih >= 0;

  const modalNode = (
    <div className="fixed inset-0 z-[9999] bg-slate-950/78 backdrop-blur-md">
      <div className="flex h-screen w-screen items-center justify-center p-3 sm:p-4 lg:p-6">
        <div className="relative flex w-full max-w-7xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,#101826_0%,#0b1220_34%,#060b14_100%)] text-white shadow-[0_24px_90px_rgba(0,0,0,0.5)] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-32px)] lg:max-h-[calc(100vh-48px)] sm:rounded-[34px]">
          <div className="border-b border-white/10 bg-white/[0.03] px-5 py-4 sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                    {readOnly ? "Detail Realisasi" : "Realisasi Penjualan"}
                  </div>

                  <div className="min-w-0 truncate text-sm font-medium text-slate-300 sm:text-base">
                    {project?.nama_project || "Project"}
                  </div>
                </div>

                <h2 className="mt-3 text-[28px] font-semibold leading-none tracking-tight sm:text-[30px]">
                  {readOnly ? "Detail Penjualan Properti" : "Input Penjualan Properti"}
                </h2>
              </div>

              <button
                onClick={onClose}
                type="button"
                disabled={isSaving}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-6">
                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-white">
                      Nilai Transaksi
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {readOnly
                        ? "Angka realisasi penjualan yang sudah tersimpan."
                        : "Tanggal jual dan nominal final akan langsung memengaruhi durasi, profit, dan ROI."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Mulai Project
                      </label>
                      <div className="rounded-[22px] border border-white/10 bg-slate-950/40 px-4 py-4">
                        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Dari project.mulai_tanggal
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-300">
                            <CalendarDays className="h-4 w-4" />
                          </div>
                          <div className="text-base font-semibold text-white">
                            {formatDisplayDate(mulaiTanggal)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Tanggal Terjual
                      </label>
                      <CalendarPicker
                        value={tanggalTerjual}
                        minDate={mulaiTanggal}
                        onChange={setTanggalTerjual}
                        disabled={readOnly}
                      />
                      {invalidTanggal ? (
                        <p className="mt-2 text-xs text-rose-300">
                          Tanggal terjual tidak boleh lebih awal dari mulai project.
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Harga Jual Final
                      </label>
                      <div
                        className={`group rounded-[22px] border px-4 py-4 transition ${
                          readOnly
                            ? "border-white/8 bg-slate-950/25"
                            : "border-white/10 bg-slate-950/50 focus-within:border-emerald-400/40 focus-within:bg-slate-950"
                        }`}
                      >
                        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Nilai penjualan
                        </div>
                        <input
                          inputMode="numeric"
                          disabled={readOnly}
                          value={hargaJualInput}
                          onChange={(e) =>
                            setHargaJualInput(
                              toInputCurrency(parseFormattedNumber(e.target.value))
                            )
                          }
                          placeholder="0"
                          className="w-full bg-transparent text-[28px] font-semibold leading-none text-white outline-none placeholder:text-slate-600 disabled:cursor-default"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Total Biaya Akuisisi
                      </label>
                      <div
                        className={`group rounded-[22px] border px-4 py-4 transition ${
                          readOnly
                            ? "border-white/8 bg-slate-950/25"
                            : "border-white/10 bg-slate-950/50 focus-within:border-cyan-400/40 focus-within:bg-slate-950"
                        }`}
                      >
                        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Modal proyek
                        </div>
                        <input
                          inputMode="numeric"
                          disabled={readOnly}
                          value={totalBiayaAkuisisiInput}
                          onChange={(e) =>
                            setTotalBiayaAkuisisiInput(
                              toInputCurrency(parseFormattedNumber(e.target.value))
                            )
                          }
                          placeholder="0"
                          className="w-full bg-transparent text-[28px] font-semibold leading-none text-white outline-none placeholder:text-slate-600 disabled:cursor-default"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-white">
                      Komponen Biaya Penjualan
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {readOnly
                        ? "Komponen biaya saat realisasi penjualan disimpan."
                        : "Semua biaya dihitung langsung dari harga jual final."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                        <Percent className="h-4 w-4 text-emerald-300" />
                        PPh
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={readOnly}
                        value={pphInput}
                        onChange={(e) => setPphInput(e.target.value)}
                        placeholder="0"
                        className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/40 disabled:cursor-default disabled:opacity-90 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <div className="text-xs text-slate-400">Nominal</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {formatIDR(pphNominal)}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                        <Percent className="h-4 w-4 text-cyan-300" />
                        AJB
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={readOnly}
                        value={ajbInput}
                        onChange={(e) => setAjbInput(e.target.value)}
                        placeholder="0"
                        className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 disabled:cursor-default disabled:opacity-90 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <div className="text-xs text-slate-400">Nominal</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {formatIDR(ajbNominal)}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                        <Wallet className="h-4 w-4 text-violet-300" />
                        Agent Fee
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={readOnly}
                        value={agentFeeInput}
                        onChange={(e) => setAgentFeeInput(e.target.value)}
                        placeholder="0"
                        className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/40 disabled:cursor-default disabled:opacity-90 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <div className="text-xs text-slate-400">Nominal</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {formatIDR(agentFeeNominal)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Distribusi Investor
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Distribusi profit mengikuti porsi kepemilikan atau fallback
                        ke proporsi nominal komitmen.
                      </p>
                    </div>

                    <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-right">
                      <div className="text-xs text-slate-400">Total Porsi</div>
                      <div className="text-sm font-semibold text-white">
                        {formatPercent(totalDistribusiPercent)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {distributions.length > 0 ? (
                      distributions.map((inv) => (
                        <div
                          key={inv.id_agent}
                          className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              {inv.avatar ? (
                                <img
                                  src={inv.avatar}
                                  alt={inv.nama}
                                  className="h-11 w-11 rounded-full border border-white/10 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white">
                                  {getInitials(inv.nama)}
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="truncate text-base font-semibold text-white">
                                  {inv.nama}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {inv.id_agent}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                              Porsi {formatPercent(inv.porsiPercent)}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <div className="text-xs text-slate-400">Modal</div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {formatIDR(inv.modal)}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <div className="text-xs text-slate-400">
                                {profitBersih >= 0 ? "Profit" : "Porsi Kerugian"}
                              </div>
                              <div
                                className={`mt-1 text-sm font-semibold ${
                                  profitBersih >= 0 ? "text-emerald-300" : "text-rose-300"
                                }`}
                              >
                                {formatIDR(inv.profit)}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white/[0.04] p-3">
                              <div className="text-xs text-slate-400">
                                Total Diterima
                              </div>
                              <div className="mt-1 text-sm font-semibold text-cyan-300">
                                {formatIDR(inv.totalDiterima)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                        Belum ada data investor pada project ini.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-white">
                      Ringkasan Finansial
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Fokus hanya pada angka inti yang paling penting.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <SummaryMetric
                      label="Durasi Holding"
                      value={durasiLabel}
                      tone="cyan"
                      helper={`Dari ${formatDisplayDate(mulaiTanggal)} sampai ${formatDisplayDate(
                        tanggalTerjual
                      )}`}
                    />

                    <SummaryMetric
                      label="Profit Kotor"
                      value={formatIDR(profitKotor)}
                      tone={profitKotor >= 0 ? "default" : "negative"}
                    />

                    <SummaryMetric
                      label="Total Biaya Transaksi"
                      value={formatIDR(totalBiayaTransaksi)}
                      tone="warning"
                    />

                    <div
                      className={`rounded-[26px] border p-5 ${
                        isProfitPositive
                          ? "border-emerald-500/20 bg-emerald-500/10"
                          : "border-rose-500/20 bg-rose-500/10"
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                        Profit Bersih
                      </div>
                      <div
                        className={`mt-2 text-[34px] font-semibold leading-none tracking-tight ${
                          isProfitPositive ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {formatIDR(profitBersih)}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        Hasil akhir setelah seluruh biaya transaksi dikurangkan dari
                        profit kotor.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/10 p-4">
                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-emerald-200/80">
                          <TrendingUp className="h-4 w-4" />
                          ROI Kotor
                        </div>
                        <div className="text-2xl font-semibold text-emerald-300">
                          {formatPercent(roiKotor)}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-emerald-100/70">
                          Profit kotor dibanding total biaya akuisisi
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/10 p-4">
                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                          <TrendingUp className="h-4 w-4" />
                          ROI Bersih
                        </div>
                        <div className="text-2xl font-semibold text-cyan-300">
                          {formatPercent(roiBersih)}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-cyan-100/70">
                          Profit bersih dibanding total biaya akuisisi
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 text-sm font-medium text-white">
                        Validasi Cepat
                      </div>
                      <div className="space-y-2 text-sm text-slate-400">
                        <div className="flex items-center justify-between gap-4">
                          <span>Total distribusi profit</span>
                          <span className="font-medium text-slate-200">
                            {formatIDR(totalDistribusiProfit)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Total porsi investor</span>
                          <span className="font-medium text-slate-200">
                            {formatPercent(totalDistribusiPercent)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Durasi (hari)</span>
                          <span className="font-medium text-slate-200">
                            {durasiHari > 0 ? `${durasiHari} hari` : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/80 px-5 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {readOnly ? "Tutup" : "Batal"}
              </button>

              {!readOnly ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving || invalidTanggal}
                  className="inline-flex min-w-[170px] items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Simpan Penjualan"
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}