"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

type Props = {
  open: boolean;
  initial?: Date | null;
  title?: string;
  /** Labels of records that will be synced. Shown as chips
   *  in the header so user understands the cascade. */
  syncLabels?: string[];
  onClose: () => void;
  onSelect: (date: Date) => void | Promise<void>;
};

const ID_MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const ID_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const ID_DAYS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const ID_DAYS_LONG = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

/* Build a 6x7 grid (42 slots) starting from Monday of the first week
   containing the month's day 1. */
function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // JS getDay(): 0 = Sun, 1 = Mon, ... 6 = Sat
  // We want Mon-first: Mon=0, Tue=1, ... Sun=6
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    grid.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return grid;
}

export default function DatePickerModal({
  open,
  initial,
  title = "Pilih Tanggal",
  syncLabels,
  onClose,
  onSelect,
}: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selected, setSelected] = useState<Date>(
    initial ? startOfDay(initial) : today
  );
  // viewYear/viewMonth = bulan yang sedang ditampilkan di grid
  const [viewYear, setViewYear] = useState<number>(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selected.getMonth());
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      const init = initial ? startOfDay(initial) : today;
      setSelected(init);
      setViewYear(init.getFullYear());
      setViewMonth(init.getMonth());
      setShowYearPicker(false);
      setShowMonthPicker(false);
      setSlideDir(null);
      setClosing(false);
      setSaving(false);
      setSaved(false);
      setErrorMsg(null);
      // Trigger entrance animation
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [open, initial, today]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // Year list (10 years range around selected year, sortable)
  const yearOptions = useMemo(() => {
    const base = today.getFullYear();
    const arr: number[] = [];
    for (let y = base - 5; y <= base + 6; y++) arr.push(y);
    if (!arr.includes(viewYear)) arr.push(viewYear);
    return arr.sort((a, b) => b - a);
  }, [viewYear, today]);

  function gotoMonth(delta: number) {
    setSlideDir(delta > 0 ? "left" : "right");
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
    // Reset slide direction after animation
    window.setTimeout(() => setSlideDir(null), 320);
  }

  function setYear(y: number) {
    setSlideDir(y > viewYear ? "left" : "right");
    setViewYear(y);
    setShowYearPicker(false);
    window.setTimeout(() => setSlideDir(null), 320);
  }

  function setMonth(m: number) {
    setSlideDir(m > viewMonth ? "left" : "right");
    setViewMonth(m);
    setShowMonthPicker(false);
    window.setTimeout(() => setSlideDir(null), 320);
  }

  function pickQuick(daysFromToday: number) {
    const d = new Date(today);
    d.setDate(today.getDate() + daysFromToday);
    setSelected(d);
    setSlideDir(daysFromToday >= 0 ? "left" : "right");
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    window.setTimeout(() => setSlideDir(null), 320);
  }

  function handleClose() {
    setClosing(true);
    setMounted(false);
    window.setTimeout(() => onClose(), 200);
  }

  async function handleConfirm() {
    if (saving || saved) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await onSelect(selected);
      setSaving(false);
      setSaved(true);
      // Show success state briefly before closing — premium "tick" moment
      window.setTimeout(() => handleClose(), 900);
    } catch (e: any) {
      setSaving(false);
      setErrorMsg(e?.message || "Gagal menyimpan tanggal");
    }
  }

  if (!open && !closing) return null;
  if (typeof document === "undefined") return null;

  const monthLabel = ID_MONTHS_LONG[viewMonth];
  const dayLabel = ID_DAYS_LONG[(selected.getDay() + 6) % 7];

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 transition-all duration-200 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md" />

      {/* Modal */}
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md overflow-hidden rounded-[28px] border border-emerald-400/15 bg-gradient-to-b from-[#0d1a16] via-[#0a1311] to-[#070a0b] shadow-[0_0_0_1px_rgba(52,211,153,0.08),0_40px_120px_rgba(0,0,0,0.9)] transition-all duration-300 ease-out ${
          mounted
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-[0.96] opacity-0"
        }`}
      >
        {/* Ambient orbs + hairlines */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

        {/* HEADER */}
        <div className="relative flex items-start justify-between gap-3 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/80">
              {title}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="bg-gradient-to-br from-white to-emerald-100 bg-clip-text text-3xl font-extrabold leading-none tracking-tight text-transparent tabular-nums">
                {selected.getDate()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {ID_MONTHS_SHORT[selected.getMonth()]} {selected.getFullYear()}
                </p>
                <p className="truncate text-[11px] font-medium text-emerald-300/70">
                  {dayLabel}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] text-slate-300 transition hover:border-rose-400/30 hover:bg-rose-500/15 hover:text-rose-200"
          >
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
            >
              <path d="M1 1 L13 13 M13 1 L1 13" />
            </svg>
          </button>
        </div>

        {/* SYNC NOTICE — kasih tau user record apa aja yang ikut update */}
        {syncLabels && syncLabels.length > 0 && (
          <div className="relative mx-5 mb-3 flex items-start gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] px-3 py-2 sm:mx-6">
            <Icon
              icon="solar:link-circle-bold-duotone"
              className="mt-0.5 shrink-0 text-sm text-emerald-300"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                Otomatis disinkronkan
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {syncLabels.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-500/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200"
                  >
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* QUICK CHIPS */}
        <div className="relative -mx-1 flex gap-1.5 overflow-x-auto px-5 pb-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { label: "Hari Ini", days: 0 },
            { label: "Besok", days: 1 },
            { label: "+7 Hari", days: 7 },
            { label: "+30 Hari", days: 30 },
          ].map((q) => {
            const target = new Date(today);
            target.setDate(today.getDate() + q.days);
            const active = sameDay(selected, target);
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => pickQuick(q.days)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-300 ${
                  active
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.2)]"
                    : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Icon
                  icon={active ? "solar:check-circle-bold" : "solar:calendar-linear"}
                  className={`text-[12px] ${active ? "text-emerald-300" : ""}`}
                />
                {q.label}
              </button>
            );
          })}
        </div>

        {/* MONTH NAV */}
        <div className="relative flex items-center justify-between gap-2 px-5 pb-3 sm:px-6">
          <button
            type="button"
            onClick={() => gotoMonth(-1)}
            aria-label="Bulan sebelumnya"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 transition hover:border-emerald-400/25 hover:bg-emerald-500/10 hover:text-emerald-200 active:scale-95"
          >
            <Icon icon="solar:alt-arrow-left-bold" className="text-base" />
          </button>

          <div className="flex items-center gap-1.5">
            {/* Month chip with dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowMonthPicker((v) => !v);
                  setShowYearPicker(false);
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold tracking-tight transition ${
                  showMonthPicker
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                    : "border-white/[0.08] bg-white/[0.03] text-white hover:border-emerald-400/25 hover:bg-emerald-500/10"
                }`}
              >
                {monthLabel}
                <Icon
                  icon="solar:alt-arrow-down-bold"
                  className={`text-[10px] transition-transform duration-300 ${
                    showMonthPicker ? "rotate-180 text-emerald-300" : "text-slate-400"
                  }`}
                />
              </button>
              {showMonthPicker && (
                <>
                  <div
                    className="fixed inset-0 z-[20]"
                    onClick={() => setShowMonthPicker(false)}
                  />
                  <div className="absolute left-0 top-[calc(100%+8px)] z-[30] grid w-44 grid-cols-3 gap-1 rounded-2xl border border-white/[0.08] bg-[#0a1311] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl">
                    {ID_MONTHS_SHORT.map((m, i) => {
                      const active = i === viewMonth;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMonth(i)}
                          className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition ${
                            active
                              ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30"
                              : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Year chip with dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowYearPicker((v) => !v);
                  setShowMonthPicker(false);
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold tabular-nums tracking-tight transition ${
                  showYearPicker
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                    : "border-white/[0.08] bg-white/[0.03] text-white hover:border-emerald-400/25 hover:bg-emerald-500/10"
                }`}
              >
                {viewYear}
                <Icon
                  icon="solar:alt-arrow-down-bold"
                  className={`text-[10px] transition-transform duration-300 ${
                    showYearPicker ? "rotate-180 text-emerald-300" : "text-slate-400"
                  }`}
                />
              </button>
              {showYearPicker && (
                <>
                  <div
                    className="fixed inset-0 z-[20]"
                    onClick={() => setShowYearPicker(false)}
                  />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-[30] max-h-56 w-32 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0a1311] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl">
                    {yearOptions.map((y) => {
                      const active = y === viewYear;
                      return (
                        <button
                          key={y}
                          type="button"
                          onClick={() => setYear(y)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-bold tabular-nums transition ${
                            active
                              ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30"
                              : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          {y}
                          {active && (
                            <Icon icon="solar:check-circle-bold" className="text-xs text-emerald-300" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => gotoMonth(1)}
            aria-label="Bulan berikutnya"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 transition hover:border-emerald-400/25 hover:bg-emerald-500/10 hover:text-emerald-200 active:scale-95"
          >
            <Icon icon="solar:alt-arrow-right-bold" className="text-base" />
          </button>
        </div>

        {/* DAY HEADER */}
        <div className="relative grid grid-cols-7 gap-1 px-5 pb-2 sm:px-6">
          {ID_DAYS_SHORT.map((d, i) => (
            <div
              key={d}
              className={`text-center text-[10px] font-bold uppercase tracking-wider ${
                i === 6 ? "text-rose-300/60" : "text-slate-500"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* DAY GRID with slide animation */}
        <div className="relative overflow-hidden px-5 pb-3 sm:px-6">
          <div
            key={`${viewYear}-${viewMonth}`}
            className={`grid grid-cols-7 gap-1 ${
              slideDir === "left"
                ? "animate-[dp-slide-left_300ms_ease-out]"
                : slideDir === "right"
                ? "animate-[dp-slide-right_300ms_ease-out]"
                : ""
            }`}
          >
            {grid.map((d, idx) => {
              const inMonth = d.getMonth() === viewMonth;
              const isToday = sameDay(d, today);
              const isSelected = sameDay(d, selected);
              const isSunday = d.getDay() === 0;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelected(d)}
                  className={`group relative flex aspect-square items-center justify-center rounded-xl text-[12px] font-bold tabular-nums transition-all duration-200 ${
                    isSelected
                      ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_4px_18px_-4px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300/50 scale-[1.04]"
                      : inMonth
                      ? isSunday
                        ? "text-rose-300/85 hover:bg-rose-500/10 hover:text-rose-100"
                        : "text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-100"
                      : "text-slate-600 hover:bg-white/[0.04] hover:text-slate-400"
                  }`}
                  style={{
                    animationDelay: `${idx * 8}ms`,
                  }}
                >
                  {/* Selected glow halo */}
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-0.5 rounded-xl bg-emerald-400/30 blur-md animate-pulse"
                    />
                  )}
                  <span className="relative z-10">{d.getDate()}</span>

                  {/* Today indicator dot */}
                  {isToday && !isSelected && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-1 h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {errorMsg && (
          <div className="relative mx-5 mb-3 flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.08] px-3 py-2 sm:mx-6">
            <Icon
              icon="solar:danger-triangle-bold-duotone"
              className="shrink-0 text-sm text-rose-300"
            />
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-rose-200">
              {errorMsg}
            </p>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="relative flex items-center gap-2 px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving || saved}
            className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || saved}
            className={`group relative flex flex-[1.4] items-center justify-center gap-2 overflow-hidden rounded-2xl border px-4 py-3 text-xs font-extrabold uppercase tracking-wider transition-all duration-500 disabled:cursor-not-allowed ${
              saved
                ? "border-emerald-300/60 bg-gradient-to-br from-emerald-400/35 via-emerald-500/30 to-emerald-600/40 text-white shadow-[0_12px_32px_-8px_rgba(16,185,129,0.8)]"
                : "border-emerald-400/30 bg-gradient-to-br from-emerald-500/25 via-emerald-500/20 to-emerald-600/30 text-emerald-50 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] hover:from-emerald-500/35 hover:to-emerald-600/40 hover:shadow-[0_12px_32px_-8px_rgba(16,185,129,0.75)] disabled:opacity-60"
            }`}
          >
            {/* Sweep shimmer */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-all ease-out ${
                saved
                  ? "left-[120%] duration-1000"
                  : "duration-700 group-hover:left-[120%]"
              }`}
            />
            {saved ? (
              <>
                {/* Saved success state — circle check with bouncy entrance */}
                <span className="relative grid h-5 w-5 place-items-center">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-emerald-300/30 animate-ping"
                  />
                  <Icon
                    icon="solar:check-circle-bold"
                    className="relative text-base text-white"
                  />
                </span>
                Tersimpan
              </>
            ) : saving ? (
              <>
                <Icon icon="solar:refresh-bold" className="animate-spin text-sm" />
                Menyimpan…
              </>
            ) : (
              <>
                <Icon icon="solar:calendar-mark-bold-duotone" className="text-sm" />
                Simpan Tanggal
                <Icon
                  icon="solar:alt-arrow-right-bold"
                  className="text-[10px] transition-transform group-hover:translate-x-1"
                />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
