"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Loader2,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import type {
  CreateProjectFormValues,
  FundingInvestorAllocation,
  InvestorOption,
  ModalTierTheme,
  ProjectModalApiResponse,
} from "../../types";

import {
  createEmptyInvestorAllocation,
  formatCurrency,
  formatNumberDots,
  getBiayaBalikNamaBreakdown,
  normalizeImageUrl,
  parseFormattedNumber,
} from "../../utils";

type Props = {
  form: CreateProjectFormValues;
  updateField: <K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) => void;
  theme: ModalTierTheme;
};

function formatSharePercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0.00%";
  return `${value.toFixed(2)}%`;
}

function getModeCardClass(active: boolean, tone: "emerald" | "sky") {
  if (!active) {
    return "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]";
  }

  return tone === "emerald"
    ? "border-emerald-400/25 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
    : "border-sky-400/25 bg-sky-500/[0.08] shadow-[0_0_0_1px_rgba(59,130,246,0.08)]";
}

function parseISODate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getMonthCells(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startOffset = firstDayOfMonth.getDay();
  const startDate = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date,
      inMonth: date.getMonth() === month,
      isToday: isSameDay(date, new Date()),
    };
  });
}

function formatLongDate(value?: string | null) {
  const parsed = parseISODate(value);
  if (!parsed) return "Pilih tanggal penutupan";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function InvestorAvatar({
  name,
  src,
}: {
  name: string;
  src?: string | null;
}) {
  const normalized = useMemo(() => normalizeImageUrl(src), [src]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    normalized ? "loading" : "error"
  );

  useEffect(() => {
    setStatus(normalized ? "loading" : "error");
  }, [normalized]);

  const initial = (name || "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[16px] bg-white/[0.05] ring-1 ring-white/10">
      {normalized && status !== "error" ? (
        <>
          {status !== "loaded" ? (
            <div className="absolute inset-0 animate-pulse bg-white/[0.06]" />
          ) : null}

          <img
            src={normalized}
            alt={name}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            draggable={false}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className={`h-full w-full object-cover transition-opacity duration-200 ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
          {initial}
        </div>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  note,
  accent = "default",
}: {
  label: string;
  value: number;
  note?: string;
  accent?: "default" | "emerald" | "rose";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "rose"
      ? "text-rose-300"
      : "text-white";

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          {note ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
          ) : null}
        </div>

        <p className={`shrink-0 text-right text-base font-bold ${valueClass}`}>
          {formatCurrency(value)}
        </p>
      </div>
    </div>
  );
}

function MiniFee({
  label,
  percent,
  value,
}: {
  label: string;
  percent: string;
  value: number;
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/20 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xs text-slate-400">{percent}</p>
      <p className="mt-2 text-sm font-semibold text-white">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}

type FancyDatePickerProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
};

function FancyDatePicker({ value, onChange }: FancyDatePickerProps) {
  const selectedDate = parseISODate(value);
  const [viewDate, setViewDate] = useState<Date>(selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) {
      setViewDate(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      );
    }
  }, [value]);

  const cells = useMemo(() => getMonthCells(viewDate), [viewDate]);

  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(viewDate);

  const weekdayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  function applyDate(date: Date) {
    onChange(formatISODate(date));
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#09111d]/95 p-4 shadow-[0_32px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-white">
            <CalendarDays className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              Tanggal penutupan round
            </p>
            <p className="mt-1 truncate text-xs text-slate-400">
              {formatLongDate(value)}
            </p>
          </div>
        </div>

        <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
          Inline
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setViewDate((prev) => addMonths(prev, -1))}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-sm font-semibold capitalize text-white">
          {monthLabel}
        </p>

        <button
          type="button"
          onClick={() => setViewDate((prev) => addMonths(prev, 1))}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {weekdayLabels.map((day) => (
          <div
            key={day}
            className="flex h-9 items-center justify-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
          >
            {day}
          </div>
        ))}

        {cells.map((cell) => {
          const selected = selectedDate ? isSameDay(cell.date, selectedDate) : false;

          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              onClick={() => applyDate(cell.date)}
              className={`flex h-11 items-center justify-center rounded-2xl text-sm font-semibold transition ${
                selected
                  ? "border border-emerald-400/20 bg-emerald-500/15 text-emerald-200"
                  : cell.inMonth
                  ? "border border-white/8 bg-white/[0.03] text-white hover:border-white/15 hover:bg-white/[0.05]"
                  : "border border-transparent bg-transparent text-slate-600 hover:bg-white/[0.03]"
              }`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => applyDate(new Date())}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-white transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          Hari ini
        </button>
        <button
          type="button"
          onClick={() => applyDate(addDays(new Date(), 7))}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-white transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          +7 hari
        </button>
        <button
          type="button"
          onClick={() => applyDate(addDays(new Date(), 14))}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-white transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          +14 hari
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">Tanggal terpilih</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {formatLongDate(value)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

type InvestorComboboxProps = {
  value?: string;
  label?: string;
  avatar?: string;
  selectedIds: string[];
  onSelect: (option: InvestorOption) => void;
};

function InvestorCombobox({
  value,
  label,
  avatar,
  selectedIds,
  onSelect,
}: InvestorComboboxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<InvestorOption[]>([]);

  const searchCacheRef = useRef<Map<string, InvestorOption[]>>(new Map());
  const preloadedImageRef = useRef<Set<string>>(new Set());

  const takenIds = useMemo(
    () => new Set(selectedIds.filter((id) => id && id !== value)),
    [selectedIds, value]
  );

  function preloadInvestorImages(items: InvestorOption[]) {
    for (const item of items) {
      const imageUrl = normalizeImageUrl(item.foto_profil_url);
      if (!imageUrl || preloadedImageRef.current.has(imageUrl)) continue;

      preloadedImageRef.current.add(imageUrl);

      const img = new window.Image();
      img.decoding = "async";
      img.src = imageUrl;
    }
  }

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    const imageUrl = normalizeImageUrl(avatar);
    if (!imageUrl || preloadedImageRef.current.has(imageUrl)) return;

    preloadedImageRef.current.add(imageUrl);

    const img = new window.Image();
    img.decoding = "async";
    img.src = imageUrl;
  }, [avatar]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const cacheKey = query.trim().toLowerCase();

    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setOptions(cached);
      preloadInvestorImages(cached);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          include_listings: "0",
          include_investors: "1",
          investor_limit: "12",
          investor_q: query,
        });

        const response = await fetch(`/api/project/modal?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Gagal mengambil data investor");
        }

        const payload: ProjectModalApiResponse = await response.json();
        const investors = Array.isArray(payload.investors) ? payload.investors : [];

        searchCacheRef.current.set(cacheKey, investors);
        setOptions(investors);
        preloadInvestorImages(investors);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setOptions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const displayLabel = label?.trim() || value?.trim() || "";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-14 w-full items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.04] px-3 text-left transition hover:border-white/15 hover:bg-white/[0.055] ${
          open ? "border-white/20 bg-white/[0.06]" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {displayLabel ? (
            <>
              <InvestorAvatar name={displayLabel} src={avatar} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {displayLabel}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {value || "Investor terpilih"}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-dashed border-white/10 bg-white/[0.03] text-slate-400">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  Pilih investor
                </p>
                <p className="text-xs text-slate-500">
                  Cari nama, kantor, kota, atau ID agent
                </p>
              </div>
            </>
          )}
        </div>

        <ChevronRight
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-[24px] border border-white/10 bg-[#09111d]/95 p-3 shadow-[0_32px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari investor..."
              className="h-12 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex h-24 items-center justify-center rounded-[18px] border border-white/8 bg-white/[0.02] text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat investor...
              </div>
            ) : options.length ? (
              options.map((option) => {
                const disabled =
                  takenIds.has(option.id_agent) && option.id_agent !== value;

                return (
                  <button
                    key={option.id_agent}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onSelect(option);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-start gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                      disabled
                        ? "cursor-not-allowed border-white/8 bg-white/[0.02] opacity-45"
                        : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
                    }`}
                  >
                    <InvestorAvatar
                      name={option.nama || option.id_agent}
                      src={option.foto_profil_url}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {option.nama || option.id_agent}
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                          {option.id_agent}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-xs text-slate-400">
                        {option.nama_kantor || "Tanpa kantor"}
                        {option.kota_area ? ` • ${option.kota_area}` : ""}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {option.jabatan || "Investor"}
                        {option.nomor_whatsapp
                          ? ` • ${option.nomor_whatsapp}`
                          : ""}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
                Investor tidak ditemukan.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FundingInvestorStep({
  form,
  updateField,
  theme,
}: Props) {
  const isOpenRound = form.jenis_pendanaan === "terbuka";

  const allocations = useMemo(() => {
    const raw = form.investor_allocations || [];
    return raw.length ? raw : [createEmptyInvestorAllocation(1)];
  }, [form.investor_allocations]);

  const selectedInvestorIds = useMemo(
    () =>
      allocations
        .map((item) => String(item.investor_id || "").trim())
        .filter(Boolean),
    [allocations]
  );

  const financials = useMemo(() => {
    const acquisitionBase = Number(form.nilai_limit_lelang || 0);
    const spareBidding = Number(form.spare_bidding || 0);
    const biayaEksekusi = Number(form.biaya_eksekusi || 0);
    const biayaRenov = Number(form.biaya_renov || 0);
    const targetPendanaan = Number(form.target_pendanaan || 0);

    const biayaBalikNama = getBiayaBalikNamaBreakdown(acquisitionBase);

    const totalBiayaBalikNama =
      Number(biayaBalikNama.bea_lelang || 0) +
      Number(biayaBalikNama.bphtb || 0) +
      Number(biayaBalikNama.ppn_lelang || 0) +
      Number(biayaBalikNama.balik_nama || 0) +
      Number(biayaBalikNama.roya || 0);

    const totalBiayaAkuisisi =
      acquisitionBase +
      spareBidding +
      totalBiayaBalikNama +
      biayaEksekusi +
      biayaRenov;

    return {
      acquisition_base_label: "Nilai Limit Lelang",
      acquisition_base: acquisitionBase,
      spare_bidding: spareBidding,
      biaya_balik_nama: {
        bea_lelang: Number(biayaBalikNama.bea_lelang || 0),
        bphtb: Number(biayaBalikNama.bphtb || 0),
        ppn_lelang: Number(biayaBalikNama.ppn_lelang || 0),
        balik_nama: Number(biayaBalikNama.balik_nama || 0),
        roya: Number(biayaBalikNama.roya || 0),
        total: totalBiayaBalikNama,
      },
      biaya_eksekusi: biayaEksekusi,
      biaya_renov: biayaRenov,
      total_biaya_akuisisi: totalBiayaAkuisisi,
      target_pendanaan: targetPendanaan,
      dana_cadangan: targetPendanaan - totalBiayaAkuisisi,
    };
  }, [
    form.nilai_limit_lelang,
    form.spare_bidding,
    form.biaya_eksekusi,
    form.biaya_renov,
    form.target_pendanaan,
  ]);

  const totalAllocated = useMemo(
    () =>
      allocations.reduce((sum, item) => sum + Number(item.nominal || 0), 0),
    [allocations]
  );

  const coverageAkuisisi =
    financials.total_biaya_akuisisi > 0
      ? (totalAllocated / financials.total_biaya_akuisisi) * 100
      : 0;

  const sisaBiayaAkuisisi = financials.total_biaya_akuisisi - totalAllocated;

  useEffect(() => {
    if (form.total_pendanaan !== totalAllocated) {
      updateField("total_pendanaan", totalAllocated);
    }
  }, [form.total_pendanaan, totalAllocated, updateField]);

  function setFundingType(type: "terbuka" | "tertutup") {
    updateField("jenis_pendanaan", type);
  }

  function syncAllocations(next: FundingInvestorAllocation[]) {
    updateField("investor_allocations", next);

    const investorIds = Array.from(
      new Set(
        next
          .map((item) => String(item.investor_id || "").trim())
          .filter(Boolean)
      )
    );

    updateField("invitedInvestorIds", investorIds);
  }

  function updateAllocation(
    rowId: string,
    patch: Partial<FundingInvestorAllocation>
  ) {
    const next = allocations.map((item) =>
      item.id === rowId ? { ...item, ...patch } : item
    );
    syncAllocations(next);
  }

  function addAllocationRow() {
    syncAllocations([
      ...allocations,
      createEmptyInvestorAllocation(Date.now()),
    ]);
  }

  function removeAllocationRow(rowId: string) {
    const next = allocations.filter((item) => item.id !== rowId);
    syncAllocations(
      next.length ? next : [createEmptyInvestorAllocation(Date.now())]
    );
  }

  const modeLabel = isOpenRound ? "Pendanaan Terbuka" : "Pendanaan Tertutup";
  const visibilityLabel = isOpenRound
    ? "Round dibuka ke investor eligible sampai tanggal yang Anda tetapkan."
    : "Round hanya tersedia untuk investor yang Anda pilih secara spesifik.";

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,15,28,0.98),rgba(12,22,40,0.94)_40%,rgba(8,15,28,0.99))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(16,185,129,0.10),transparent_16%),radial-gradient(circle_at_10%_4%,rgba(255,255,255,0.03),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.016),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/[0.04]" />

      <div className="relative">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Step 3 · Funding Structure
            </div>

            <h3 className="mt-4 text-[24px] font-semibold tracking-tight text-white sm:text-[28px]">
              Biaya Akuisisi & Investor Commitment
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Semua angka di step ini hanya menampilkan hasil dari data step
              sebelumnya. Investor share dihitung dari total biaya akuisisi,
              sementara selisih terhadap target pendanaan dibaca sebagai dana
              cadangan round.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Round Mode
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white">
              {modeLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">{visibilityLabel}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => setFundingType("terbuka")}
            className={`group rounded-[28px] border p-5 text-left transition ${getModeCardClass(
              isOpenRound,
              "emerald"
            )}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border ${
                  isOpenRound
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-slate-300"
                }`}
              >
                <Globe2 className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[18px] font-semibold text-white">
                    Pendanaan Terbuka
                  </p>
                  {isOpenRound ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                      Active
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Investor eligible dapat mengakses round hingga tanggal
                  penutupan.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFundingType("tertutup")}
            className={`group rounded-[28px] border p-5 text-left transition ${getModeCardClass(
              !isOpenRound,
              "sky"
            )}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border ${
                  !isOpenRound
                    ? "border-sky-400/20 bg-sky-500/10 text-sky-200"
                    : "border-white/10 bg-white/[0.04] text-slate-300"
                }`}
              >
                <LockKeyhole className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[18px] font-semibold text-white">
                    Pendanaan Tertutup
                  </p>
                  {!isOpenRound ? (
                    <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200">
                      Active
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Investor dipilih langsung, lengkap dengan nominal commitment.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[0.98fr_1.02fr]">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[18px] font-semibold text-white">
                  Breakdown Biaya Akuisisi
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Read-only. Semua nominal diambil dari step sebelumnya dan
                  dihitung otomatis.
                </p>
              </div>

              <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/80">
                  Total Akuisisi
                </p>
                <p className="mt-1 text-sm font-bold text-emerald-200">
                  {formatCurrency(financials.total_biaya_akuisisi)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <BreakdownRow
                label={financials.acquisition_base_label}
                value={financials.acquisition_base}
                note="Nilai limit lelang sebagai basis utama perhitungan balik nama."
              />

              <BreakdownRow
                label="Spare Bidding"
                value={financials.spare_bidding}
                note="Cadangan bidding tambahan di atas nilai limit."
              />

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Biaya Balik Nama
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Dihitung otomatis dari nilai limit lelang saja, tidak termasuk spare bidding.
                    </p>
                  </div>

                  <p className="shrink-0 text-right text-base font-bold text-white">
                    {formatCurrency(financials.biaya_balik_nama.total)}
                  </p>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  <MiniFee
                    label="Bea Lelang"
                    percent="2.0%"
                    value={financials.biaya_balik_nama.bea_lelang}
                  />
                  <MiniFee
                    label="BPHTB"
                    percent="5.0%"
                    value={financials.biaya_balik_nama.bphtb}
                  />
                  <MiniFee
                    label="PPN Lelang"
                    percent="1.1%"
                    value={financials.biaya_balik_nama.ppn_lelang}
                  />
                  <MiniFee
                    label="Roya"
                    percent="Rp 75 rb"
                    value={financials.biaya_balik_nama.roya}
                  />
                  <MiniFee
                    label="Balik Nama"
                    percent="0.1%"
                    value={financials.biaya_balik_nama.balik_nama}
                  />
                </div>
              </div>

              <BreakdownRow
                label="Biaya Eksekusi"
                value={financials.biaya_eksekusi}
                note="Biaya operasional untuk eksekusi pengosongan / penanganan lapangan."
              />

              <BreakdownRow
                label="Biaya Renovasi"
                value={financials.biaya_renov}
                note="Biaya renovasi properti yang diinput dari step sebelumnya."
              />

              <BreakdownRow
                label="Dana Cadangan"
                value={financials.dana_cadangan}
                note="Target pendanaan dikurangi total biaya akuisisi."
                accent={financials.dana_cadangan >= 0 ? "emerald" : "rose"}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04]">
                  {isOpenRound ? (
                    <Globe2 className="h-5 w-5 text-white" />
                  ) : (
                    <LockKeyhole className="h-5 w-5 text-white" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[18px] font-semibold text-white">
                    {modeLabel}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {visibilityLabel}
                  </p>
                </div>
              </div>

              {isOpenRound ? (
                <div className="mt-5 space-y-4">
                  <FancyDatePicker
                    value={form.pendanaan_ditutup_pada}
                    onChange={(next) =>
                      updateField("pendanaan_ditutup_pada", next)
                    }
                  />

                  <div className="rounded-[22px] border border-white/8 bg-white/[0.02] px-4 py-3">
                    <SummaryLine
                      label="Target pendanaan"
                      value={formatCurrency(financials.target_pendanaan)}
                    />
                    <div className="border-t border-white/6" />
                    <SummaryLine
                      label="Total biaya akuisisi"
                      value={formatCurrency(financials.total_biaya_akuisisi)}
                    />
                    <div className="border-t border-white/6" />
                    <SummaryLine
                      label="Dana cadangan"
                      value={formatCurrency(financials.dana_cadangan)}
                      valueClassName={
                        financials.dana_cadangan >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[18px] font-semibold text-white">
                        Investor Commitment
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Klik dropdown untuk pilih atau ganti investor.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addAllocationRow}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/15 hover:bg-white/[0.06]"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {allocations.map((row, index) => {
                      const nominal = Number(row.nominal || 0);
                      const sharePercent =
                        financials.total_biaya_akuisisi > 0
                          ? (nominal / financials.total_biaya_akuisisi) * 100
                          : 0;

                      return (
                        <div
                          key={row.id}
                          className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-bold uppercase tracking-[0.14em] text-white">
                              Investor {index + 1}
                            </div>

                            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white">
                              Share {formatSharePercent(sharePercent)}
                            </div>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_220px_52px]">
                            <InvestorCombobox
                              value={row.investor_id}
                              label={row.investor_nama || row.investor_label}
                              avatar={row.investor_avatar}
                              selectedIds={selectedInvestorIds}
                              onSelect={(option) =>
                                updateAllocation(row.id, {
                                  investor_id: option.id_agent,
                                  investor_nama: option.nama,
                                  investor_label: option.label,
                                  investor_avatar: option.foto_profil_url,
                                })
                              }
                            />

                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNumberDots(row.nominal)}
                              onChange={(e) =>
                                updateAllocation(row.id, {
                                  nominal: parseFormattedNumber(e.target.value),
                                })
                              }
                              placeholder="Nominal modal"
                              className="h-14 w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/[0.06]"
                            />

                            <button
                              type="button"
                              onClick={() => removeAllocationRow(row.id)}
                              className="inline-flex h-14 w-12 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-rose-400/20 hover:bg-rose-500/10 hover:text-rose-200"
                              aria-label={`Hapus investor ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.02] px-4 py-3">
                    <SummaryLine
                      label="Total investor masuk"
                      value={formatCurrency(totalAllocated)}
                      valueClassName={theme.accentText}
                    />
                    <div className="border-t border-white/6" />
                    <SummaryLine
                      label="Coverage terhadap akuisisi"
                      value={
                        financials.total_biaya_akuisisi > 0
                          ? `${coverageAkuisisi.toFixed(2)}%`
                          : "-"
                      }
                    />
                    <div className="border-t border-white/6" />
                    <SummaryLine
                      label="Sisa biaya akuisisi"
                      value={formatCurrency(sisaBiayaAkuisisi)}
                      valueClassName={
                        sisaBiayaAkuisisi <= 0
                          ? "text-emerald-300"
                          : "text-white"
                      }
                    />
                    <div className="border-t border-white/6" />
                    <SummaryLine
                      label="Dana cadangan round"
                      value={formatCurrency(financials.dana_cadangan)}
                      valueClassName={
                        financials.dana_cadangan >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-[20px] border border-amber-400/15 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-100/90">
              <span className="font-semibold">Catatan:</span> share investor
              dihitung dari <span className="font-semibold">total biaya akuisisi</span>,
              bukan dari target pendanaan. Dana cadangan otomatis dihitung dari{" "}
              <span className="font-semibold">target pendanaan - total biaya akuisisi</span>.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}