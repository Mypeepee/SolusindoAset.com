"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

/* ────────────────────────────────────────────────────────────────────
   DateInput — custom date picker, glass futuristic UI.
     • Value & onChange pakai ISO "YYYY-MM-DD" (sama dengan input
       <input type="date">) supaya drop-in replacement.
     • Calendar panel di-portal ke <body> dengan z-index di atas modal
       (z-[10001]) supaya escape stacking context modal-acara.
     • Bahasa Indonesia: "Sen / Sel / Rab / ..." untuk hari, "Jan /
       Feb / ..." untuk bulan, "Hari Ini" quick-action.
   ──────────────────────────────────────────────────────────────────── */

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agt", "Sep", "Okt", "Nov", "Des",
];
const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface DateInputProps {
  /** ISO "YYYY-MM-DD" — kosong "" untuk no-value. */
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Min date di ISO format, format YYYY-MM-DD. */
  minDate?: string;
  /** Max date di ISO format, format YYYY-MM-DD. */
  maxDate?: string;
  /** Status error visual — border merah + ring rose. */
  error?: boolean;
  placeholder?: string;
}

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLabel(d: Date): string {
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DateInput({
  value,
  onChange,
  readOnly = false,
  minDate,
  maxDate,
  error = false,
  placeholder = "Pilih tanggal…",
}: DateInputProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Cursor month untuk navigasi prev/next — independent dari value
  const initialCursor = useMemo(() => {
    const parsed = parseISO(value);
    return parsed ?? new Date();
  }, [value]);
  const [cursor, setCursor] = useState<Date>(initialCursor);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync cursor saat value berubah dari luar (mis. selectedEvent ke-load)
  useEffect(() => {
    const parsed = parseISO(value);
    if (parsed) setCursor(parsed);
  }, [value]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      // Default: drop down. Kalau ga muat di bawah, drop up.
      const panelHeight = 360;
      const flipUp =
        rect.bottom + panelHeight + 12 > window.innerHeight &&
        rect.top - panelHeight > 8;
      setPos({
        top: flipUp ? rect.top - panelHeight - 6 : rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const selectedDate = parseISO(value);
  const today = startOfDay(new Date());
  const min = minDate ? parseISO(minDate) : null;
  const max = maxDate ? parseISO(maxDate) : null;

  const isDisabled = (d: Date) => {
    const s = startOfDay(d);
    if (min && s < startOfDay(min)) return true;
    if (max && s > startOfDay(max)) return true;
    return false;
  };

  // Hitung grid 6×7 untuk bulan yang lagi di-cursor
  const grid = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const firstDay = new Date(y, m, 1);
    const startWeekday = firstDay.getDay(); // 0 = Min
    const start = new Date(y, m, 1 - startWeekday);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return days;
  }, [cursor]);

  const handlePick = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(toISO(d));
    setOpen(false);
  };

  const goPrev = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => {
    const t = startOfDay(new Date());
    onChange(toISO(t));
    setCursor(t);
    setOpen(false);
  };

  const labelText = selectedDate ? formatLabel(selectedDate) : placeholder;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (readOnly) return;
          setOpen((o) => !o);
        }}
        disabled={readOnly}
        className={`group relative flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition-all ${
          readOnly
            ? "cursor-default border-white/10 bg-white/5"
            : error
            ? "border-rose-500/60 bg-rose-500/5 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
            : open
            ? "border-emerald-500/60 bg-white/10 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
            : "border-white/10 bg-white/5 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
        }`}
      >
        <span
          className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg transition ${
            open
              ? "bg-emerald-500/20 ring-1 ring-emerald-400/40"
              : error
              ? "bg-rose-500/10 ring-1 ring-rose-400/30"
              : "bg-white/[0.06] ring-1 ring-white/[0.08]"
          }`}
        >
          <Icon
            icon="solar:calendar-bold-duotone"
            className={`text-[16px] ${
              open
                ? "text-emerald-300"
                : error
                ? "text-rose-300"
                : "text-slate-300 group-hover:text-emerald-300"
            }`}
          />
        </span>
        <span
          className={`flex-1 truncate ${
            selectedDate
              ? "text-white"
              : error
              ? "text-rose-300/70"
              : "text-slate-500"
          }`}
        >
          {labelText}
        </span>
        {!readOnly && (
          <Icon
            icon="solar:alt-arrow-down-bold"
            className={`text-[12px] text-slate-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {open && mounted && pos &&
        createPortal(
          <>
            {/* Scrim — z-[10000] supaya di atas modal-acara (z-[9999]) */}
            <div
              className="fixed inset-0 z-[10000]"
              onClick={() => setOpen(false)}
            />

            {/* Calendar panel */}
            <div
              className="fixed z-[10001] overflow-hidden rounded-2xl border border-white/[0.14] p-3 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl backdrop-saturate-150"
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 320),
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 40%), rgba(12,18,23,0.92)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: month/year + prev/next */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-200"
                  aria-label="Bulan sebelumnya"
                >
                  <Icon icon="solar:alt-arrow-left-bold" className="text-[14px]" />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">
                    {BULAN_PANJANG[cursor.getMonth()]}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-emerald-300">
                    {cursor.getFullYear()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={goNext}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-200"
                  aria-label="Bulan berikutnya"
                >
                  <Icon icon="solar:alt-arrow-right-bold" className="text-[14px]" />
                </button>
              </div>

              {/* Weekday header */}
              <div className="grid grid-cols-7 gap-1 px-0.5">
                {HARI.map((h, i) => (
                  <div
                    key={h}
                    className={`text-center text-[9.5px] font-extrabold uppercase tracking-widest ${
                      i === 0 || i === 6 ? "text-rose-400/80" : "text-slate-500"
                    }`}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="mt-1 grid grid-cols-7 gap-1">
                {grid.map((d) => {
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const isSel =
                    !!selectedDate &&
                    d.getFullYear() === selectedDate.getFullYear() &&
                    d.getMonth() === selectedDate.getMonth() &&
                    d.getDate() === selectedDate.getDate();
                  const isToday =
                    d.getFullYear() === today.getFullYear() &&
                    d.getMonth() === today.getMonth() &&
                    d.getDate() === today.getDate();
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const disabled = isDisabled(d);
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => handlePick(d)}
                      disabled={disabled}
                      className={`relative grid h-9 place-items-center rounded-lg text-[12px] font-bold transition-all duration-150 ${
                        disabled
                          ? "cursor-not-allowed opacity-25"
                          : isSel
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-[#05070D] shadow-[0_6px_18px_-6px_rgba(52,211,153,0.7)]"
                          : isToday
                          ? "border border-emerald-400/40 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/15"
                          : inMonth
                          ? isWeekend
                            ? "text-rose-300/80 hover:bg-white/[0.06]"
                            : "text-slate-200 hover:bg-white/[0.06]"
                          : "text-slate-600 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="tabular-nums">{d.getDate()}</span>
                      {isToday && !isSel && (
                        <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer quick-action */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                <button
                  type="button"
                  onClick={goToday}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.08] px-2.5 py-1.5 text-[10.5px] font-bold text-emerald-200 transition hover:bg-emerald-500/[0.15]"
                >
                  <Icon icon="solar:target-bold-duotone" className="text-[12px]" />
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold text-slate-400 transition hover:text-white"
                >
                  Tutup
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

export default DateInput;
