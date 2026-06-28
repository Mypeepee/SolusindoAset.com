'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuctionDatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  error?: string;
}

const DAY_ABBR = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'];
const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

function fmtDisplay(d: Date) {
  return (
    d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
    `, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`
  );
}

export function AuctionDatePicker({ value, onChange, error }: AuctionDatePickerProps) {
  const [open, setOpen]     = useState(false);
  const [mounted, setMounted] = useState(false);
  const today = new Date();

  const [viewYear, setViewYear]     = useState(() => value?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth]   = useState(() => value?.getMonth()    ?? today.getMonth());
  const [draftDate, setDraftDate]   = useState<Date | null>(() => value ?? null);
  const [draftHour, setDraftHour]   = useState(() => value?.getHours()   ?? 10);
  const [draftMinute, setDraftMinute] = useState(() => value?.getMinutes() ?? 0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (value) {
      setDraftDate(value);
      setViewYear(value.getFullYear());
      setViewMonth(value.getMonth());
      setDraftHour(value.getHours());
      setDraftMinute(value.getMinutes());
    }
  }, [value]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  /* ── Calendar cells — always 42 (6 rows × 7) so card height never changes ── */
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);          // pad to exactly 42

  const isSelected = (d: number) =>
    !!draftDate &&
    draftDate.getFullYear() === viewYear &&
    draftDate.getMonth()    === viewMonth &&
    draftDate.getDate()     === d;

  const isToday = (d: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth()    === viewMonth &&
    today.getDate()     === d;

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleConfirm = () => {
    if (!draftDate) return;
    const d = new Date(draftDate);
    d.setHours(draftHour, draftMinute, 0, 0);
    onChange(d);
    setOpen(false);
  };

  const handleClear = () => {
    setDraftDate(null);
    setDraftHour(10);
    setDraftMinute(0);
    onChange(undefined);
    setOpen(false);
  };

  /* ─────────────────────────── MODAL ─────────────────────────── */
  const modal = (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop: pure dark, no blur — like Linear / Stripe ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9998] bg-black/75"
            onClick={() => setOpen(false)}
          />

          {/* ── Centered modal — same layout on all screen sizes ── */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto w-full max-w-[312px]"
            >
              {/* Card */}
              <div className="relative rounded-2xl bg-[#0f0f13] border border-amber-500/20 overflow-hidden shadow-2xl shadow-black">

                {/* Top shimmer */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none" />

                {/*
                  ── HEADER LAYOUT ──────────────────────────────────
                  [×]        Bulan Tahun        [←] [→]
                  Close at far-left, nav pair at far-right.
                  Maximum separation → zero confusion between × and →.
                  Arrow pair is ALWAYS at the same fixed pixel position
                  regardless of month name width → consistent tap target.
                */}
                <div className="flex items-center justify-between px-2 pt-3.5 pb-2">

                  {/* ✕ Close — fixed far-left */}
                  <motion.button
                    type="button"
                    onClick={() => setOpen(false)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.88 }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-200 hover:bg-white/5 transition-all flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>

                  {/* Month / Year — centered, animated */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`${viewMonth}-${viewYear}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.1 }}
                      className="text-[13px] font-bold text-white tracking-wide select-none"
                    >
                      {MONTHS_ID[viewMonth]} {viewYear}
                    </motion.p>
                  </AnimatePresence>

                  {/* ← → Pair — fixed far-right, always at the same spot */}
                  <div className="flex items-center gap-0 flex-shrink-0">
                    <motion.button
                      type="button"
                      onClick={goPrev}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.88 }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={goNext}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.88 }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </div>

                </div>

                {/* ── Day-of-week headers ── */}
                <div className="grid grid-cols-7 px-2">
                  {DAY_ABBR.map((d, i) => (
                    <div key={i} className="flex items-center justify-center h-6">
                      <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">{d}</span>
                    </div>
                  ))}
                </div>

                {/*
                  ── Calendar grid — ALWAYS 42 cells (6 × 7) ──
                  Height never changes → arrow positions never jump.
                */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${viewMonth}-${viewYear}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.07 }}
                    className="grid grid-cols-7 px-2 pb-1"
                  >
                    {cells.map((day, i) => (
                      <div key={i} className="flex items-center justify-center h-9">
                        {day !== null && (
                          <motion.button
                            type="button"
                            whileHover={!isSelected(day) ? { scale: 1.16 } : {}}
                            whileTap={{ scale: 0.86 }}
                            onClick={() => setDraftDate(new Date(viewYear, viewMonth, day))}
                            className={cn(
                              'relative w-8 h-8 rounded-xl flex items-center justify-center text-xs font-medium transition-all duration-100 select-none',
                              isSelected(day)
                                ? [
                                    'bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold',
                                    'shadow-[0_0_14px_2px_rgba(245,158,11,0.40)] scale-[1.08]',
                                  ]
                                : isToday(day)
                                ? 'text-amber-400 font-semibold hover:bg-amber-500/10'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                            )}
                          >
                            {day}
                            {/* Apple-style dot for today (when not selected) */}
                            {isToday(day) && !isSelected(day) && (
                              <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-amber-500" />
                            )}
                          </motion.button>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* ── Time picker ── */}
                <div className="mx-3 h-px bg-white/[0.05]" />
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex-shrink-0 w-9">
                    Pukul
                  </span>

                  <div className="flex items-center gap-2 flex-1 justify-center">
                    {/* Hour ‹ HH › */}
                    <div className="flex items-center gap-1">
                      <motion.button type="button" onClick={() => setDraftHour(h => (h - 1 + 24) % 24)}
                        whileTap={{ scale: 0.85 }}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-amber-400 transition-colors rounded-lg hover:bg-amber-500/10">
                        <ChevronLeft className="w-3 h-3" />
                      </motion.button>
                      <div className="w-10 h-8 rounded-lg bg-black/50 border border-amber-500/20 flex items-center justify-center">
                        <span className="text-sm font-black text-amber-400 tabular-nums">
                          {String(draftHour).padStart(2, '0')}
                        </span>
                      </div>
                      <motion.button type="button" onClick={() => setDraftHour(h => (h + 1) % 24)}
                        whileTap={{ scale: 0.85 }}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-amber-400 transition-colors rounded-lg hover:bg-amber-500/10">
                        <ChevronRight className="w-3 h-3" />
                      </motion.button>
                    </div>

                    <span className="text-sm font-black text-amber-500/30 leading-none">:</span>

                    {/* Minute ‹ MM › */}
                    <div className="flex items-center gap-1">
                      <motion.button type="button" onClick={() => setDraftMinute(m => (m - 5 + 60) % 60)}
                        whileTap={{ scale: 0.85 }}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-amber-400 transition-colors rounded-lg hover:bg-amber-500/10">
                        <ChevronLeft className="w-3 h-3" />
                      </motion.button>
                      <div className="w-10 h-8 rounded-lg bg-black/50 border border-amber-500/20 flex items-center justify-center">
                        <span className="text-sm font-black text-amber-400 tabular-nums">
                          {String(draftMinute).padStart(2, '0')}
                        </span>
                      </div>
                      <motion.button type="button" onClick={() => setDraftMinute(m => (m + 5) % 60)}
                        whileTap={{ scale: 0.85 }}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-amber-400 transition-colors rounded-lg hover:bg-amber-500/10">
                        <ChevronRight className="w-3 h-3" />
                      </motion.button>
                    </div>

                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">WIB</span>
                  </div>
                </div>

                {/* ── Draft preview strip ── */}
                <AnimatePresence>
                  {draftDate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mx-3 mb-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="text-[10px] text-amber-300/80 font-medium truncate">
                          {draftDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                          {' · '}{String(draftHour).padStart(2, '0')}:{String(draftMinute).padStart(2, '0')} WIB
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Actions ── */}
                <div className="mx-3 h-px bg-white/[0.05]" />
                <div className="px-3 py-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-2.5 text-[11px] font-semibold text-slate-600 hover:text-slate-300 transition-colors rounded-xl hover:bg-white/5"
                  >
                    Hapus
                  </button>
                  <motion.button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!draftDate}
                    whileHover={draftDate ? { scale: 1.02 } : {}}
                    whileTap={draftDate ? { scale: 0.97 } : {}}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200',
                      draftDate
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20'
                        : 'bg-white/5 text-slate-600 cursor-not-allowed',
                    )}
                  >
                    {draftDate ? '✓  Konfirmasi Jadwal' : 'Pilih tanggal dulu'}
                  </motion.button>
                </div>

                {/* Bottom shimmer */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  /* ─────────────────────────── TRIGGER ─────────────────────────── */
  return (
    <div>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.995 }}
        className={cn(
          'w-full h-12 px-4 rounded-xl border-2 flex items-center justify-between gap-3 transition-all duration-200',
          open
            ? 'border-amber-500/50 bg-slate-900/80 ring-2 ring-amber-500/10'
            : error
            ? 'border-red-500/40 bg-red-500/5'
            : 'border-slate-800 bg-slate-900/50 hover:border-amber-500/30',
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarDays className={cn('w-4 h-4 flex-shrink-0 transition-colors', value ? 'text-amber-400' : 'text-slate-600')} />
          <span className={cn('text-sm truncate', value ? 'font-medium text-slate-100' : 'text-slate-500')}>
            {value ? fmtDisplay(value) : 'Pilih tanggal & waktu lelang...'}
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
          <ChevronDown className="w-4 h-4 text-slate-600" />
        </motion.div>
      </motion.button>

      {mounted && createPortal(modal, document.body)}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
