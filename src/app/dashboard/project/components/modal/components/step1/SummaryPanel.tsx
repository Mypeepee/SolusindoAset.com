"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Building2,
  MapPinned,
  Ruler,
  ShieldCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  CreateProjectFormValues,
  ListingOption,
  ModalTierTheme,
} from "../../types";
import {
  formatCategoryLabel,
  formatTransactionLabel,
  normalizeImageUrl,
} from "../../utils";

type Props = {
  selectedListing: ListingOption | null;
  form: CreateProjectFormValues;
  theme: ModalTierTheme;
  hargaPembelianComputed: number;
  profitComputed: number;
  roiPercent: number;
  onTanggalPembelianChange?: (value: string | null) => void;
};

function formatArea(value?: number | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "-";

  return (
    new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    }).format(numeric) + " m²"
  );
}

function formatLegalitas(value?: string | null) {
  if (!value) return "-";

  return value
    .toString()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPrimaryImage(
  listing: ListingOption | null,
  fallback?: string | null
): string {
  return normalizeImageUrl(
    listing?.gambar_thumbnail || listing?.gambar || fallback || ""
  );
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

function formatLongDate(
  value?: string | null,
  placeholder = "Pilih tanggal pembelian"
) {
  const parsed = parseISODate(value);
  if (!parsed) return placeholder;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

type InlineFancyDatePickerProps = {
  value?: string | null;
  onChange?: (value: string | null) => void;
};

function InlineFancyDatePicker({
  value,
  onChange,
}: InlineFancyDatePickerProps) {
  const selectedDate = parseISODate(value);
  const [viewDate, setViewDate] = useState<Date>(selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) {
      setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [value]);

  const cells = useMemo(() => getMonthCells(viewDate), [viewDate]);

  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(viewDate);

  const weekdayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  function applyDate(date: Date) {
    onChange?.(formatISODate(date));
  }

  return (
    <div className="rounded-[22px] border border-white/10 bg-black/10 p-3">
      <div className="rounded-[24px] border border-white/10 bg-[#09111d]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-white">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                Tanggal pembelian project
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
                    ? "border border-emerald-400/20 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.06),0_10px_24px_rgba(16,185,129,0.10)]"
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
            onClick={() => onChange?.(null)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/15 hover:bg-white/[0.06]"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SummaryPanel({
  selectedListing,
  form,
  theme,
  onTanggalPembelianChange,
}: Props) {
  const ThemeIcon = theme.icon;
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = useMemo(
    () => getPrimaryImage(selectedListing, form.gambar_thumbnail),
    [selectedListing, form.gambar_thumbnail]
  );

  const alamatLengkap =
    selectedListing?.alamat_lengkap ||
    selectedListing?.alamat_property ||
    form.alamat_property?.trim() ||
    "Belum ada property yang dipilih";

  const lokasiLengkap = [
    selectedListing?.kelurahan || form.kelurahan || "",
    selectedListing?.kecamatan || form.kecamatan || "",
    selectedListing?.kota || form.kota || "",
    selectedListing?.provinsi || form.provinsi || "",
  ].filter(Boolean);

  const isLelang = selectedListing?.jenis_transaksi === "LELANG";

  const detailItems = [
    {
      key: "luas_tanah",
      label: "Luas Tanah",
      value: formatArea(selectedListing?.luas_tanah),
      icon: Ruler,
    },
    ...(!isLelang
      ? [
          {
            key: "luas_bangunan",
            label: "Luas Bangunan",
            value: formatArea(selectedListing?.luas_bangunan),
            icon: Ruler,
          },
        ]
      : []),
    {
      key: "legalitas",
      label: "Legalitas",
      value: formatLegalitas(selectedListing?.legalitas),
      icon: ShieldCheck,
    },
  ];

  return (
    <aside className="min-w-0">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,22,33,0.96),rgba(24,33,47,0.88)_45%,rgba(14,21,31,0.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:p-4 xl:sticky xl:top-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_24%),radial-gradient(circle_at_85%_20%,rgba(96,165,250,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[27px] border border-white/[0.04]" />

        <div className="relative">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <ThemeIcon className="h-4 w-4 text-white" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                Preview Property
              </p>
              <p className="text-xs text-slate-400">
                Ringkasan aset terpilih.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
              <div className="relative h-[150px] w-full overflow-hidden bg-black/20">
                {imageUrl && !imageFailed ? (
                  <img
                    src={imageUrl}
                    alt={alamatLengkap}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] text-slate-500">
                    <Building2 className="h-7 w-7" />
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,18,0.02),rgba(5,10,18,0.14)_48%,rgba(5,10,18,0.60)_100%)]" />

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedListing ? (
                      <>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                          {formatCategoryLabel(selectedListing.kategori)}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                          {formatTransactionLabel(selectedListing.jenis_transaksi)}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                          ID #{form.id_listing || selectedListing.id_listing}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                        Belum dipilih
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
              <div className="flex items-start gap-2">
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.17em] text-slate-500">
                    Alamat Lengkap
                  </p>
                  <p className="mt-2 break-words text-[14px] font-semibold leading-7 text-white">
                    {alamatLengkap}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.17em] text-slate-500">
                Lokasi
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {lokasiLengkap.length > 0 ? (
                  lokasiLengkap.map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-200"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">
                    Lokasi belum tersedia.
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/10 p-3">
              <div className="grid gap-2">
                {detailItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.025] px-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04]">
                          <Icon className="h-4 w-4 text-slate-400" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <InlineFancyDatePicker
              value={form.tanggal_pembelian}
              onChange={onTanggalPembelianChange}
            />
          </div>
        </div>
      </section>
    </aside>
  );
}