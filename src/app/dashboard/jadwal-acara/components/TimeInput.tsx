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
   TimeInput — custom time picker, glass futuristic UI.
     • Value & onChange pakai format "HH:MM" (sama dengan input
       <input type="time">) supaya drop-in replacement.
     • Two-column wheel picker: jam (00–23) + menit (00–55, step 5).
       Klik chip = langsung set. Drag-scroll didukung native via
       overflow-y-auto.
     • Preset cepat ("08:00 / 09:00 / 13:00 / 15:00 / ...") di atas
       buat skenario meeting tipikal.
   ──────────────────────────────────────────────────────────────────── */

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PRESETS = ["08:00", "09:00", "10:00", "13:00", "14:00", "15:00", "16:00"];

function parseTime(s: string): { h: number; m: number } | null {
  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function fmt(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function labelPart(s: string): string {
  const t = parseTime(s);
  if (!t) return "Pilih waktu";
  const period = t.h < 12 ? "Pagi" : t.h < 15 ? "Siang" : t.h < 18 ? "Sore" : "Malam";
  return `${fmt(t.h, t.m)} · ${period}`;
}

interface TimeInputProps {
  /** "HH:MM". */
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Visual error state (border merah). */
  error?: boolean;
  placeholder?: string;
}

export function TimeInput({
  value,
  onChange,
  readOnly = false,
  error = false,
  placeholder = "Pilih jam…",
}: TimeInputProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const parsed = useMemo(() => parseTime(value), [value]);
  const h = parsed?.h ?? 9;
  const m = parsed?.m ?? 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const panelHeight = 320;
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

  // Auto-scroll jam & menit aktif ke tengah panel saat dibuka
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const hSel = hourListRef.current?.querySelector<HTMLButtonElement>(
        `[data-h="${h}"]`,
      );
      const mSel = minuteListRef.current?.querySelector<HTMLButtonElement>(
        `[data-m="${m}"]`,
      );
      hSel?.scrollIntoView({ block: "center", behavior: "auto" });
      mSel?.scrollIntoView({ block: "center", behavior: "auto" });
    }, 30);
    return () => window.clearTimeout(t);
  }, [open, h, m]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pickHour = (nh: number) => onChange(fmt(nh, m));
  const pickMinute = (nm: number) => onChange(fmt(h, nm));
  const pickPreset = (s: string) => {
    onChange(s);
    setOpen(false);
  };

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
            icon="solar:clock-circle-bold-duotone"
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
          className={`flex-1 truncate tabular-nums ${
            parsed
              ? "text-white"
              : error
              ? "text-rose-300/70"
              : "text-slate-500"
          }`}
        >
          {parsed ? labelPart(value) : placeholder}
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
            <div
              className="fixed inset-0 z-[10000]"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-[10001] overflow-hidden rounded-2xl border border-white/[0.14] p-3 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl backdrop-saturate-150"
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 300),
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 40%), rgba(12,18,23,0.92)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Presets */}
              <div className="mb-2.5">
                <p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                  Preset Cepat
                </p>
                <div className="flex flex-wrap gap-1">
                  {PRESETS.map((p) => {
                    const active = value === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => pickPreset(p)}
                        className={`rounded-md border px-2 py-1 text-[10.5px] font-bold tabular-nums transition ${
                          active
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wheel: Jam + Menit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                    Jam
                  </p>
                  <div
                    ref={hourListRef}
                    className="h-44 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] py-1 [scrollbar-width:thin]"
                  >
                    {HOURS.map((hh) => {
                      const active = hh === h;
                      return (
                        <button
                          key={hh}
                          data-h={hh}
                          type="button"
                          onClick={() => pickHour(hh)}
                          className={`block w-full px-3 py-1.5 text-center text-sm font-bold tabular-nums transition ${
                            active
                              ? "bg-gradient-to-r from-emerald-500/20 to-emerald-500/[0.05] text-emerald-100"
                              : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          {String(hh).padStart(2, "0")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                    Menit
                  </p>
                  <div
                    ref={minuteListRef}
                    className="h-44 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] py-1 [scrollbar-width:thin]"
                  >
                    {MINUTES.map((mm) => {
                      const active = mm === m;
                      return (
                        <button
                          key={mm}
                          data-m={mm}
                          type="button"
                          onClick={() => pickMinute(mm)}
                          className={`block w-full px-3 py-1.5 text-center text-sm font-bold tabular-nums transition ${
                            active
                              ? "bg-gradient-to-r from-emerald-500/20 to-emerald-500/[0.05] text-emerald-100"
                              : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          {String(mm).padStart(2, "0")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                <span className="text-[10px] text-slate-500">
                  Dipilih:{" "}
                  <span className="font-bold tabular-nums text-emerald-300">
                    {parsed ? fmt(h, m) : "—"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-emerald-500/[0.15] px-3 py-1 text-[10.5px] font-bold text-emerald-200 transition hover:bg-emerald-500/25"
                >
                  Selesai
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

export default TimeInput;
