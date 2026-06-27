"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

/* ════════════════════════════════════════════════════════════
   Floating anchored panel — fixed-positioned via portal, anti-clip
   ════════════════════════════════════════════════════════════ */
function useAnchoredPanel(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  estimatedHeight: number,
) {
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < estimatedHeight && r.top > spaceBelow;
      setStyle({
        position: "fixed",
        left: r.left,
        width: r.width,
        zIndex: 90,
        ...(openUp
          ? { bottom: window.innerHeight - r.top + 8 }
          : { top: r.bottom + 8 }),
      });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, anchorRef, estimatedHeight]);

  return style;
}

function useDismiss(
  open: boolean,
  close: () => void,
  ...refs: React.RefObject<HTMLElement | null>[]
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (refs.some(r => r.current?.contains(e.target as Node))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/* ════════════════════════════════════════════════════════════
   PREMIUM SELECT
   ════════════════════════════════════════════════════════════ */
export type PremiumOption = { value: string; label: string; icon?: string; dot?: string };

export function PremiumSelect({
  value, onChange, options, placeholder = "-- Pilih --",
  open: controlledOpen, onOpenChange,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PremiumOption[];
  placeholder?: string;
  /** Opsional: controlled mode — kalau diisi, parent yang pegang state buka/tutup */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (v: boolean) => { isControlled ? onOpenChange?.(v) : setInternalOpen(v); };
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const style = useAnchoredPanel(open, anchorRef, 300);
  useDismiss(open, () => setOpen(false), anchorRef, panelRef);

  const selected = options.find(o => o.value === value);

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-300 ${
          open
            ? "border-emerald-400/50 bg-white/[0.05] ring-2 ring-emerald-400/30"
            : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.18]"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot} shadow-[0_0_8px_currentColor]`} />}
          {selected?.icon && <Icon icon={selected.icon} className="shrink-0 text-base text-slate-300" />}
          <span className={`truncate ${selected ? "font-medium text-white" : "text-slate-500"}`}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <Icon
          icon="solar:alt-arrow-down-line-duotone"
          className={`shrink-0 text-base text-slate-400 transition-transform duration-300 ${open ? "rotate-180 text-emerald-300" : ""}`}
        />
      </button>

      {open && createPortal(
        <div ref={panelRef} style={style} className="crm-pop">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0e14]/95 p-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
            <div className="max-h-[260px] space-y-0.5 overflow-y-auto [scrollbar-width:thin]">
              {options.map(opt => {
                const isSel = opt.value === value;
                return (
                  <button
                    key={opt.value || "__empty"}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                      isSel ? "bg-emerald-500/10 text-white" : "text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    {opt.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot} shadow-[0_0_8px_currentColor]`} />}
                    {opt.icon && <Icon icon={opt.icon} className="shrink-0 text-base text-slate-400" />}
                    <span className="flex-1 truncate text-left font-medium">{opt.label}</span>
                    {isSel && <Icon icon="solar:check-circle-bold" className="shrink-0 text-base text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   PREMIUM DATE + TIME PICKER
   value & onChange use "YYYY-MM-DDTHH:mm" (datetime-local format)
   ════════════════════════════════════════════════════════════ */
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function PremiumDateTimePicker({
  value, onChange, placeholder = "Pilih tanggal & waktu",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen]         = useState(false);
  const [shown, setShown]       = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const anchorRef     = useRef<HTMLButtonElement>(null);
  const panelRef      = useRef<HTMLDivElement>(null);
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minScrollRef  = useRef<HTMLDivElement>(null);
  const panelStyle    = useAnchoredPanel(open && !isMobile, anchorRef, 460);

  function close() {
    setShown(false);
    setTimeout(() => setOpen(false), 280);
  }

  useDismiss(open, close, anchorRef, panelRef);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const selected = value ? new Date(value) : null;
  const valid    = selected && !isNaN(selected.getTime());
  const [view, setView] = useState<Date>(() => valid ? selected! : new Date());

  useEffect(() => {
    if (open) {
      setView(valid ? selected! : new Date());
      requestAnimationFrame(() => setShown(true));
    } else {
      setShown(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hour   = valid ? selected!.getHours()  : 9;
  const minute = valid ? selected!.getMinutes() : 0;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const scrollCenter = (ref: React.RefObject<HTMLDivElement | null>) => {
        const el = ref.current?.querySelector<HTMLElement>("[data-active='true']");
        if (el && ref.current) {
          const p = ref.current;
          p.scrollTo({ left: el.offsetLeft - p.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
        }
      };
      scrollCenter(hourScrollRef);
      scrollCenter(minScrollRef);
    }, 80);
    return () => clearTimeout(t);
  }, [open]);

  const year        = view.getFullYear();
  const month       = view.getMonth();
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function emit(d: Date) { onChange(toValue(d)); }
  function pickDay(day: number) { emit(new Date(year, month, day, hour, minute)); }
  function setTime(h: number, m: number) {
    const base = valid ? selected! : new Date(year, month, today.getDate());
    emit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m));
  }
  function moveMonth(delta: number) { setView(new Date(year, month + delta, 1)); }

  const label = valid
    ? `${HARI[selected!.getDay()]}, ${selected!.getDate()} ${BULAN[selected!.getMonth()].slice(0, 3)} ${selected!.getFullYear()} · ${pad(hour)}:${pad(minute)}`
    : placeholder;

  const hours24   = Array.from({ length: 24 }, (_, i) => i);
  const minutes12 = Array.from({ length: 12 }, (_, i) => i * 5);

  const pickerInner = (
    <>
      {/* ── Calendar ── */}
      <div className="px-4 pt-1 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => moveMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 transition-all hover:bg-white/[0.07] hover:text-white active:scale-90">
            <Icon icon="solar:alt-arrow-left-bold" className="text-sm" />
          </button>
          <span className="text-[13px] font-bold tracking-wide text-white">{BULAN[month]} {year}</span>
          <button type="button" onClick={() => moveMonth(1)}
            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 transition-all hover:bg-white/[0.07] hover:text-white active:scale-90">
            <Icon icon="solar:alt-arrow-right-bold" className="text-sm" />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7">
          {HARI.map(d => (
            <span key={d} className="grid place-items-center text-[9.5px] font-bold uppercase tracking-wider text-slate-600">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-[3px]">
          {cells.map((day, i) => {
            if (day === null) return <span key={`e${i}`} />;
            const d      = new Date(year, month, day);
            const isToday = sameDay(d, today);
            const isSel   = valid && sameDay(d, selected!);
            return (
              <button key={day} type="button" onClick={() => pickDay(day)}
                className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-[12.5px] font-semibold transition-all duration-100 active:scale-90 ${
                  isSel     ? "bg-gradient-to-br from-emerald-500 to-emerald-400 text-[#04130d] shadow-[0_0_18px_rgba(16,185,129,0.55)]"
                  : isToday ? "ring-1 ring-emerald-400/50 text-emerald-300"
                  :           "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {day}
                {isToday && !isSel && (
                  <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Time horizontal strips ── */}
      <div className="border-t border-white/[0.05] px-4 py-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon icon="solar:clock-circle-bold-duotone" className="text-sm text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Waktu</span>
          </div>
          {valid && (
            <span className="font-mono text-[15px] font-bold tabular-nums tracking-widest text-emerald-300">
              {pad(hour)}<span className="opacity-50">:</span>{pad(minute)}
            </span>
          )}
        </div>

        <div className="mb-2.5">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">Jam</p>
          <div ref={hourScrollRef} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {hours24.map(h => {
              const active = h === hour;
              return (
                <button key={h} type="button" data-active={active} onClick={() => setTime(h, minute)}
                  className={`shrink-0 flex h-9 w-[38px] items-center justify-center rounded-xl text-[12px] font-bold tabular-nums transition-all duration-100 active:scale-90 ${
                    active
                      ? "bg-gradient-to-b from-emerald-500/30 to-emerald-600/10 ring-1 ring-emerald-400/70 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.3)]"
                      : "text-slate-500 hover:bg-white/[0.07] hover:text-slate-200"
                  }`}
                >
                  {pad(h)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">Menit</p>
          <div ref={minScrollRef} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {minutes12.map(m => {
              const active = m === minute;
              return (
                <button key={m} type="button" data-active={active} onClick={() => setTime(hour, m)}
                  className={`shrink-0 flex h-9 w-[38px] items-center justify-center rounded-xl text-[12px] font-bold tabular-nums transition-all duration-100 active:scale-90 ${
                    active
                      ? "bg-gradient-to-b from-emerald-500/30 to-emerald-600/10 ring-1 ring-emerald-400/70 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.3)]"
                      : "text-slate-500 hover:bg-white/[0.07] hover:text-slate-200"
                  }`}
                >
                  {pad(m)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => { onChange(""); close(); }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-rose-300">
          <Icon icon="solar:trash-bin-minimalistic-line-duotone" className="text-sm" />
          Hapus
        </button>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => { const n = new Date(); emit(new Date(n.getFullYear(), n.getMonth(), n.getDate(), 9, 0)); }}
            className="rounded-xl border border-white/[0.08] px-3 py-2 text-[11.5px] font-semibold text-slate-200 transition-all hover:border-emerald-400/30 hover:bg-emerald-500/[0.07]">
            Hari ini
          </button>
          <button type="button" onClick={close}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2 text-[11.5px] font-bold text-[#04130d] transition-all hover:shadow-[0_4px_16px_-4px_rgba(16,185,129,0.8)] active:scale-95">
            <Icon icon="solar:check-circle-bold" className="text-sm" />
            Selesai
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button type="button" ref={anchorRef} onClick={() => open ? close() : setOpen(true)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-300 ${
          open
            ? "border-emerald-400/50 bg-white/[0.05] ring-2 ring-emerald-400/30"
            : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.18]"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon icon="solar:calendar-bold-duotone" className={`shrink-0 text-base ${valid ? "text-emerald-300" : "text-slate-400"}`} />
          <span className={`truncate ${valid ? "font-medium text-white" : "text-slate-500"}`}>{label}</span>
        </span>
        <Icon icon="solar:alt-arrow-down-line-duotone"
          className={`shrink-0 text-base text-slate-400 transition-transform duration-300 ${open ? "rotate-180 text-emerald-300" : ""}`} />
      </button>

      {open && createPortal(
        isMobile ? (
          /* ── MOBILE: bottom sheet ── */
          <div className="fixed inset-0 z-[100]">
            <div
              className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
              onClick={close}
            />
            <div
              ref={panelRef}
              className={`absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[28px] border-t border-white/[0.08] bg-[#09090d] shadow-[0_-24px_60px_rgba(0,0,0,0.85)] transition-transform duration-300 ease-out ${shown ? "translate-y-0" : "translate-y-full"}`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
              <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="mx-auto mb-1 mt-3 h-1 w-10 rounded-full bg-white/[0.15]" />
              {pickerInner}
            </div>
          </div>
        ) : (
          /* ── DESKTOP: anchored dropdown ── */
          <div ref={panelRef} style={panelStyle} className="crm-pop">
            <div className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09090d]/98 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.92)] backdrop-blur-2xl transition-opacity duration-150 ${shown ? "opacity-100" : "opacity-0"}`}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
              {pickerInner}
            </div>
          </div>
        ),
        document.body,
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   SEARCHABLE SELECT — PremiumSelect + filter input (daftar panjang)
   ════════════════════════════════════════════════════════════ */
export function SearchableSelect({
  value, onChange, options, placeholder = "-- Pilih --",
  disabled = false, loading = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PremiumOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const style = useAnchoredPanel(open, anchorRef, 320);
  useDismiss(open, () => setOpen(false), anchorRef, panelRef);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const selected = options.find(o => o.value === value);
  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, "");
  const nq = norm(q.trim());
  const filtered = nq ? options.filter(o => norm(o.label).includes(nq)) : options;

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        disabled={disabled || loading}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-300 ${
          disabled || loading
            ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] opacity-50"
            : open
            ? "border-emerald-400/50 bg-white/[0.05] ring-2 ring-emerald-400/30"
            : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.18]"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`truncate ${selected ? "font-medium text-white" : "text-slate-500"}`}>
            {loading ? "Memuat…" : selected?.label ?? placeholder}
          </span>
        </span>
        <Icon
          icon="solar:alt-arrow-down-line-duotone"
          className={`shrink-0 text-base text-slate-400 transition-transform duration-300 ${open ? "rotate-180 text-emerald-300" : ""}`}
        />
      </button>

      {open && createPortal(
        <div ref={panelRef} style={style} className="crm-pop">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0e14]/95 p-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
            <div className="relative mb-1.5 px-1 pt-1">
              <Icon icon="solar:magnifer-line-duotone" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Cari…"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-8 pr-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
            <div className="max-h-[240px] space-y-0.5 overflow-y-auto [scrollbar-width:thin]">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-center text-[12px] text-slate-500">Tidak ditemukan</p>
              ) : filtered.map(opt => {
                const isSel = opt.value === value;
                return (
                  <button
                    key={opt.value || "__empty"}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                      isSel ? "bg-emerald-500/10 text-white" : "text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="flex-1 truncate text-left font-medium">{opt.label}</span>
                    {isSel && <Icon icon="solar:check-circle-bold" className="shrink-0 text-base text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   REGION CASCADE — Provinsi → Kota → Kecamatan → Kelurahan
   Menyimpan NAMA wilayah (bukan id) supaya cocok dgn data listing.
   ════════════════════════════════════════════════════════════ */
export type RegionValue = {
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
};

type WilayahItem = { id: string; name: string };
const normName = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function fetchWilayah(level: string, parentId?: string): Promise<WilayahItem[]> {
  const qs = new URLSearchParams({ level });
  if (parentId) qs.set("parentId", parentId);
  try {
    const r = await fetch(`/api/regions/wilayah?${qs.toString()}`);
    const j = await r.json();
    return j.ok ? (j.items as WilayahItem[]) : [];
  } catch {
    return [];
  }
}

export function RegionCascadeSelect({
  value, onChange,
}: {
  value: RegionValue;
  onChange: (v: RegionValue) => void;
}) {
  const [provList, setProvList] = useState<WilayahItem[]>([]);
  const [kotaList, setKotaList] = useState<WilayahItem[]>([]);
  const [kecList, setKecList]   = useState<WilayahItem[]>([]);
  const [kelList, setKelList]   = useState<WilayahItem[]>([]);

  const [provId, setProvId] = useState("");
  const [kotaId, setKotaId] = useState("");
  const [kecId, setKecId]   = useState("");

  const [loading, setLoading] = useState({ kota: false, kec: false, kel: false });

  // Provinsi: muat sekali.
  useEffect(() => { fetchWilayah("provinsi").then(setProvList); }, []);

  // Resolusi nama → id untuk pre-fill (mode edit).
  useEffect(() => {
    if (!provList.length || !value.provinsi || provId) return;
    const m = provList.find(p => normName(p.name) === normName(value.provinsi));
    if (m) setProvId(m.id);
  }, [provList, value.provinsi, provId]);

  useEffect(() => {
    if (!provId) { setKotaList([]); return; }
    setLoading(s => ({ ...s, kota: true }));
    fetchWilayah("kota", provId).then(list => {
      setKotaList(list);
      setLoading(s => ({ ...s, kota: false }));
    });
  }, [provId]);

  useEffect(() => {
    if (!kotaList.length || !value.kota || kotaId) return;
    const m = kotaList.find(k => normName(k.name) === normName(value.kota));
    if (m) setKotaId(m.id);
  }, [kotaList, value.kota, kotaId]);

  useEffect(() => {
    if (!kotaId) { setKecList([]); return; }
    setLoading(s => ({ ...s, kec: true }));
    fetchWilayah("kecamatan", kotaId).then(list => {
      setKecList(list);
      setLoading(s => ({ ...s, kec: false }));
    });
  }, [kotaId]);

  useEffect(() => {
    if (!kecList.length || !value.kecamatan || kecId) return;
    const m = kecList.find(k => normName(k.name) === normName(value.kecamatan));
    if (m) setKecId(m.id);
  }, [kecList, value.kecamatan, kecId]);

  useEffect(() => {
    if (!kecId) { setKelList([]); return; }
    setLoading(s => ({ ...s, kel: true }));
    fetchWilayah("kelurahan", kecId).then(list => {
      setKelList(list);
      setLoading(s => ({ ...s, kel: false }));
    });
  }, [kecId]);

  const toOpts = (list: WilayahItem[]): PremiumOption[] => list.map(i => ({ value: i.id, label: i.name }));

  return (
    <div className="grid grid-cols-2 gap-3">
      <SearchableSelect
        value={provId}
        placeholder="Provinsi"
        options={toOpts(provList)}
        loading={!provList.length}
        onChange={id => {
          const name = provList.find(p => p.id === id)?.name ?? "";
          setProvId(id); setKotaId(""); setKecId("");
          setKotaList([]); setKecList([]); setKelList([]);
          onChange({ provinsi: name, kota: "", kecamatan: "", kelurahan: "" });
        }}
      />
      <SearchableSelect
        value={kotaId}
        placeholder="Kota / Kabupaten"
        options={toOpts(kotaList)}
        disabled={!provId}
        loading={loading.kota}
        onChange={id => {
          const name = kotaList.find(k => k.id === id)?.name ?? "";
          setKotaId(id); setKecId("");
          setKecList([]); setKelList([]);
          onChange({ ...value, kota: name, kecamatan: "", kelurahan: "" });
        }}
      />
      <SearchableSelect
        value={kecId}
        placeholder="Kecamatan"
        options={toOpts(kecList)}
        disabled={!kotaId}
        loading={loading.kec}
        onChange={id => {
          const name = kecList.find(k => k.id === id)?.name ?? "";
          setKecId(id);
          setKelList([]);
          onChange({ ...value, kecamatan: name, kelurahan: "" });
        }}
      />
      <SearchableSelect
        value={kelList.find(k => normName(k.name) === normName(value.kelurahan))?.id ?? ""}
        placeholder="Kelurahan"
        options={toOpts(kelList)}
        disabled={!kecId}
        loading={loading.kel}
        onChange={id => {
          const name = kelList.find(k => k.id === id)?.name ?? "";
          onChange({ ...value, kelurahan: name });
        }}
      />
    </div>
  );
}
