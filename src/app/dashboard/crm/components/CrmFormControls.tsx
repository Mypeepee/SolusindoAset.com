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
}: {
  value: string;
  onChange: (v: string) => void;
  options: PremiumOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
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
        onClick={() => setOpen(o => !o)}
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
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minListRef = useRef<HTMLDivElement>(null);
  const style = useAnchoredPanel(open, anchorRef, 440);
  useDismiss(open, () => setOpen(false), anchorRef, panelRef);

  const selected = value ? new Date(value) : null;
  const valid = selected && !isNaN(selected.getTime());
  const [view, setView] = useState<Date>(() => (valid ? selected! : new Date()));

  useEffect(() => {
    if (open) setView(valid ? selected! : new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hour = valid ? selected!.getHours() : 9;
  const minute = valid ? selected!.getMinutes() : 0;

  // auto-scroll time columns to current selection
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      hourListRef.current?.querySelector<HTMLElement>("[data-active='true']")
        ?.scrollIntoView({ block: "center" });
      minListRef.current?.querySelector<HTMLElement>("[data-active='true']")
        ?.scrollIntoView({ block: "center" });
    }, 30);
    return () => clearTimeout(t);
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function emit(d: Date) { onChange(toValue(d)); }
  function pickDay(day: number) {
    emit(new Date(year, month, day, hour, minute));
  }
  function setTime(h: number, m: number) {
    const base = valid ? selected! : new Date(year, month, today.getDate());
    emit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m));
  }
  function moveMonth(delta: number) { setView(new Date(year, month + delta, 1)); }

  const label = valid
    ? `${HARI[selected!.getDay()]}, ${selected!.getDate()} ${BULAN[selected!.getMonth()].slice(0, 3)} ${selected!.getFullYear()} · ${pad(hour)}:${pad(minute)}`
    : placeholder;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => setOpen(o => !o)}
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
        <Icon
          icon="solar:alt-arrow-down-line-duotone"
          className={`shrink-0 text-base text-slate-400 transition-transform duration-300 ${open ? "rotate-180 text-emerald-300" : ""}`}
        />
      </button>

      {open && createPortal(
        <div ref={panelRef} style={style} className="crm-pop">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/95 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.92)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-500/15 blur-2xl" />

            <div className="relative flex flex-col sm:flex-row">
              {/* Calendar */}
              <div className="p-3 sm:border-r sm:border-white/[0.06]">
                {/* Month nav */}
                <div className="mb-2 flex items-center justify-between">
                  <button type="button" onClick={() => moveMonth(-1)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white">
                    <Icon icon="solar:alt-arrow-left-line-duotone" className="text-base" />
                  </button>
                  <span className="text-[12.5px] font-bold text-white">{BULAN[month]} {year}</span>
                  <button type="button" onClick={() => moveMonth(1)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white">
                    <Icon icon="solar:alt-arrow-right-line-duotone" className="text-base" />
                  </button>
                </div>
                {/* Weekday header */}
                <div className="mb-1 grid grid-cols-7 gap-0.5">
                  {HARI.map(d => (
                    <span key={d} className="grid h-6 place-items-center text-[10px] font-bold uppercase tracking-wide text-slate-500">{d}</span>
                  ))}
                </div>
                {/* Days */}
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((day, i) => {
                    if (day === null) return <span key={`e${i}`} />;
                    const d = new Date(year, month, day);
                    const isToday = sameDay(d, today);
                    const isSel = valid && sameDay(d, selected!);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => pickDay(day)}
                        className={`relative grid h-8 w-8 place-items-center rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                          isSel
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-400 text-[#04130d] shadow-[0_4px_14px_-3px_rgba(16,185,129,0.8)]"
                            : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        {day}
                        {isToday && !isSel && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time */}
              <div className="flex w-full flex-col p-3 sm:w-[150px]">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  <Icon icon="solar:clock-circle-bold-duotone" className="text-[13px] text-emerald-300" />
                  Waktu
                </div>
                <div className="flex flex-1 gap-2">
                  {/* Hours */}
                  <div ref={hourListRef} className="max-h-[168px] flex-1 space-y-0.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {hours.map(h => {
                      const active = h === hour;
                      return (
                        <button
                          key={h}
                          type="button"
                          data-active={active}
                          onClick={() => setTime(h, minute)}
                          className={`w-full rounded-lg py-1.5 text-center text-[12px] font-semibold tabular-nums transition-colors ${
                            active ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40" : "text-slate-300 hover:bg-white/[0.06]"
                          }`}
                        >
                          {pad(h)}
                        </button>
                      );
                    })}
                  </div>
                  {/* Minutes */}
                  <div ref={minListRef} className="max-h-[168px] flex-1 space-y-0.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {minutes.map(m => {
                      const active = m === minute;
                      return (
                        <button
                          key={m}
                          type="button"
                          data-active={active}
                          onClick={() => setTime(hour, m)}
                          className={`w-full rounded-lg py-1.5 text-center text-[12px] font-semibold tabular-nums transition-colors ${
                            active ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40" : "text-slate-300 hover:bg-white/[0.06]"
                          }`}
                        >
                          {pad(m)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="relative flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-rose-300"
              >
                Hapus
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { const n = new Date(); emit(new Date(n.getFullYear(), n.getMonth(), n.getDate(), 9, 0)); }}
                  className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 px-3 py-1.5 text-[11px] font-bold text-[#04130d] transition-all hover:shadow-[0_6px_18px_-4px_rgba(16,185,129,0.8)]"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>,
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
