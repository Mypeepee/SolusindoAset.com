"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";

export type TaskFilter = "ALL" | "URGENT" | "OVERDUE" | "HOT";
export type TaskSort = "PRIORITY" | "TIME" | "COMMISSION";

const FILTERS: { value: TaskFilter; label: string; icon: string; dot?: string }[] = [
  { value: "ALL",     label: "Semua",    icon: "solar:widget-2-bold-duotone" },
  { value: "URGENT",  label: "Mendesak", icon: "solar:danger-bold-duotone", dot: "bg-rose-400" },
  { value: "OVERDUE", label: "Overdue",  icon: "solar:clock-circle-bold-duotone", dot: "bg-orange-400" },
  { value: "HOT",     label: "HOT Lead", icon: "solar:fire-bold-duotone", dot: "bg-amber-400" },
];

const SORTS: { value: TaskSort; label: string; icon: string }[] = [
  { value: "PRIORITY",   label: "Prioritas", icon: "solar:ranking-bold-duotone" },
  { value: "TIME",       label: "Waktu",     icon: "solar:clock-circle-bold-duotone" },
  { value: "COMMISSION", label: "Komisi",    icon: "solar:wallet-money-bold-duotone" },
];

interface Props {
  search: string;
  onSearch: (v: string) => void;
  filter: TaskFilter;
  onFilter: (v: TaskFilter) => void;
  sort: TaskSort;
  onSort: (v: TaskSort) => void;
  counts: Record<TaskFilter, number>;
  onAdd: () => void;
}

export function TaskToolbar({
  search, onSearch, filter, onFilter, sort, onSort, counts, onAdd,
}: Props) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const activeSort = SORTS.find((s) => s.value === sort) ?? SORTS[0];

  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sortOpen]);

  return (
    <div
      className="sticky top-2 z-30 rounded-2xl border border-white/[0.07] bg-[#0a0c12]/85 p-2.5 backdrop-blur-xl shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]"
    >
      {/* top hairline */}
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Icon
            icon="solar:magnifer-bold"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500"
          />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Cari tugas, lead, atau properti..."
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-orange-400/40 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              title="Bersihkan"
            >
              <Icon icon="solar:close-circle-bold" className="text-base" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => onFilter(f.value)}
                className={[
                  "group inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold transition-all duration-200",
                  active
                    ? "border-orange-400/40 bg-orange-400/[0.1] text-orange-200 shadow-[0_0_22px_-10px_rgba(251,146,60,0.8)]"
                    : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200",
                ].join(" ")}
              >
                {f.dot ? (
                  <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
                ) : (
                  <Icon icon={f.icon} className="text-sm" />
                )}
                {f.label}
                <span
                  className={`tabular-nums rounded-md px-1.5 py-0.5 text-[10px] ${active ? "bg-orange-400/20 text-orange-100" : "bg-white/[0.05] text-slate-500"}`}
                >
                  {counts[f.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort dropdown */}
        <div ref={sortRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12px] font-bold text-slate-300 transition-colors hover:border-white/20 hover:text-white lg:w-auto"
          >
            <span className="flex items-center gap-1.5">
              <Icon icon={activeSort.icon} className="text-sm text-slate-400" />
              <span className="text-slate-500">Urut:</span> {activeSort.label}
            </span>
            <Icon
              icon="solar:alt-arrow-down-line-duotone"
              className={`text-sm text-slate-400 transition-transform duration-300 ${sortOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`absolute right-0 z-50 mt-2 w-44 origin-top overflow-hidden rounded-xl border border-white/10 bg-[#0a0c12]/95 p-1.5 backdrop-blur-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] transition-all duration-200 ${sortOpen ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"}`}
          >
            {SORTS.map((s) => {
              const sel = s.value === sort;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => { onSort(s.value); setSortOpen(false); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors hover:bg-white/[0.06] ${sel ? "text-white" : "text-slate-300"}`}
                >
                  <Icon icon={s.icon} className="text-base text-slate-400" />
                  <span className="flex-1 text-left">{s.label}</span>
                  {sel && <Icon icon="solar:check-circle-bold" className="text-sm text-orange-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add task */}
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold text-white transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
            boxShadow: "0 4px 20px -8px rgba(234,88,12,0.9), inset 0 1px 0 rgba(255,255,255,0.14)",
          }}
        >
          <Icon icon="solar:add-circle-bold" className="text-base" />
          Tugas
        </button>
      </div>
    </div>
  );
}
