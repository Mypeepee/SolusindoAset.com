"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AuctionDateTimePickerProps = {
  value?: Date;
  onChange: (date: Date) => void;
};

const MONTHS = [
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

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const WEEK_DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const QUICK_TIMES = [
  { label: "09:00", hour: 9, minute: 0 },
  { label: "10:00", hour: 10, minute: 0 },
  { label: "13:00", hour: 13, minute: 0 },
  { label: "15:00", hour: 15, minute: 0 },
  { label: "19:00", hour: 19, minute: 0 },
];

type PickerMode = "calendar" | "month" | "year";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function combineDateAndTime(day: Date, hour: number, minute: number) {
  const next = new Date(day);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function getDefaultFutureDate() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(10, 0, 0, 0);
  return next;
}

function getCalendarDays(viewDate: Date) {
  const firstDayOfMonth = startOfMonth(viewDate);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const firstVisibleDay = new Date(firstDayOfMonth);
  firstVisibleDay.setDate(firstVisibleDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstVisibleDay);
    day.setDate(firstVisibleDay.getDate() + index);
    return day;
  });
}

function formatPreview(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function AuctionDateTimePicker({
  value,
  onChange,
}: AuctionDateTimePickerProps) {
  const safeValue =
    value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined;

  const initialValue = safeValue ?? getDefaultFutureDate();

  const [selectedDay, setSelectedDay] = React.useState<Date>(
    startOfDay(initialValue)
  );
  const [hour, setHour] = React.useState<number>(initialValue.getHours());
  const [minute, setMinute] = React.useState<number>(initialValue.getMinutes());
  const [viewDate, setViewDate] = React.useState<Date>(startOfMonth(initialValue));
  const [mode, setMode] = React.useState<PickerMode>("calendar");
  const [yearPageStart, setYearPageStart] = React.useState<number>(
    Math.floor(initialValue.getFullYear() / 12) * 12
  );

  React.useEffect(() => {
    if (!safeValue) return;

    setSelectedDay(startOfDay(safeValue));
    setHour(safeValue.getHours());
    setMinute(safeValue.getMinutes());
    setViewDate(startOfMonth(safeValue));
    setYearPageStart(Math.floor(safeValue.getFullYear() / 12) * 12);
  }, [safeValue?.getTime()]);

  const now = new Date();
  const today = startOfDay(now);

  const calendarDays = React.useMemo(() => getCalendarDays(viewDate), [viewDate]);

  const previewDate = React.useMemo(
    () => combineDateAndTime(selectedDay, hour, minute),
    [selectedDay, hour, minute]
  );

  const yearOptions = React.useMemo(
    () => Array.from({ length: 12 }, (_, index) => yearPageStart + index),
    [yearPageStart]
  );

  const commitSelection = React.useCallback(
    (nextDay: Date, nextHour = hour, nextMinute = minute) => {
      setSelectedDay(startOfDay(nextDay));
      setHour(nextHour);
      setMinute(nextMinute);

      const merged = combineDateAndTime(nextDay, nextHour, nextMinute);
      if (merged.getTime() >= new Date().getTime()) {
        onChange(merged);
      }
    },
    [hour, minute, onChange]
  );

  const goToPreviousMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const selectMonth = (monthIndex: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), monthIndex, 1));
    setMode("calendar");
  };

  const selectYear = (year: number) => {
    setViewDate((prev) => new Date(year, prev.getMonth(), 1));
    setMode("calendar");
  };

  const applyQuickDate = (daysToAdd: number) => {
    const next = new Date();
    next.setDate(next.getDate() + daysToAdd);
    next.setHours(hour, minute, 0, 0);

    setViewDate(new Date(next.getFullYear(), next.getMonth(), 1));
    setYearPageStart(Math.floor(next.getFullYear() / 12) * 12);
    commitSelection(next, hour, minute);
  };

  return (
    <div className="rounded-[28px] border border-amber-400/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.10),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.92))] p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950">
            <CalendarDays className="h-5 w-5" />
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/90">
              Jadwal Lelang
            </div>
            <div className="mt-1 text-lg font-bold text-white">
              {formatPreview(previewDate)} • {pad(hour)}:{pad(minute)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: "Hari Ini", days: 0 },
            { label: "Besok", days: 1 },
            { label: "+3 Hari", days: 3 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => applyQuickDate(item.days)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                setMode((prev) => (prev === "month" ? "calendar" : "month"))
              }
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200"
            >
              {MONTHS[viewDate.getMonth()]}
            </button>

            <button
              type="button"
              onClick={() =>
                setMode((prev) => (prev === "year" ? "calendar" : "year"))
              }
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200"
            >
              {viewDate.getFullYear()}
            </button>

            <button
              type="button"
              onClick={goToNextMonth}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <Clock3 className="h-4 w-4 text-cyan-300" />
            <select
              value={hour}
              onChange={(e) =>
                commitSelection(selectedDay, Number(e.target.value), minute)
              }
              className="bg-transparent text-sm font-semibold text-white outline-none"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i} className="bg-slate-900">
                  {pad(i)}
                </option>
              ))}
            </select>
            <span className="text-slate-500">:</span>
            <select
              value={minute}
              onChange={(e) =>
                commitSelection(selectedDay, hour, Number(e.target.value))
              }
              className="bg-transparent text-sm font-semibold text-white outline-none"
            >
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i} className="bg-slate-900">
                  {pad(i)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {mode === "month" && (
            <motion.div
              key="month"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 grid grid-cols-3 gap-2"
            >
              {MONTHS_SHORT.map((month, index) => {
                const active = index === viewDate.getMonth();
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => selectMonth(index)}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                      active
                        ? "border-amber-300/35 bg-amber-400/12 text-amber-200"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-amber-400/25 hover:bg-amber-400/8 hover:text-amber-200"
                    )}
                  >
                    {month}
                  </button>
                );
              })}
            </motion.div>
          )}

          {mode === "year" && (
            <motion.div
              key="year"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setYearPageStart((prev) => prev - 12)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200"
                >
                  -12 Tahun
                </button>

                <button
                  type="button"
                  onClick={() => setYearPageStart((prev) => prev + 12)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200"
                >
                  +12 Tahun
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {yearOptions.map((year) => {
                  const active = year === viewDate.getFullYear();
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => selectYear(year)}
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                        active
                          ? "border-amber-300/35 bg-amber-400/12 text-amber-200"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-amber-400/25 hover:bg-amber-400/8 hover:text-amber-200"
                      )}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {mode === "calendar" && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="mb-3 grid grid-cols-7 gap-2">
                {WEEK_DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex h-9 items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                  const isSelected = isSameDay(day, selectedDay);
                  const isToday = isSameDay(day, today);
                  const isDisabled = startOfDay(day).getTime() < today.getTime();

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => commitSelection(day)}
                      className={cn(
                        "relative flex h-12 items-center justify-center rounded-2xl border text-sm font-semibold transition",
                        isSelected
                          ? "border-amber-300/40 bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20"
                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-amber-400/25 hover:bg-amber-400/8",
                        !isCurrentMonth && !isSelected && "text-slate-600",
                        isToday && !isSelected && "border-emerald-400/30 text-emerald-300",
                        isDisabled &&
                          "cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-700 hover:border-white/5 hover:bg-white/[0.02]"
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_TIMES.map((item) => {
            const active = hour === item.hour && minute === item.minute;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => commitSelection(selectedDay, item.hour, item.minute)}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                  active
                    ? "border-cyan-300/30 bg-cyan-400/12 text-cyan-200"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}