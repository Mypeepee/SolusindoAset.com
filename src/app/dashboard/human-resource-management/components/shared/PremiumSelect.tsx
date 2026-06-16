// app/dashboard/hrm/components/shared/PremiumSelect.tsx
"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional tailwind text-color class for the leading status dot, e.g. "bg-emerald-400" */
  dot?: string;
  /** Optional iconify icon shown before the label */
  icon?: string;
}

interface PremiumSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Shown before the selected label, e.g. "Status:" */
  prefix?: string;
  icon?: string;
  className?: string;
  minWidthClass?: string;
}

export function PremiumSelect({
  value,
  options,
  onChange,
  placeholder = "Pilih",
  prefix,
  icon,
  className = "",
  minWidthClass = "min-w-[170px]",
}: PremiumSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const isFiltered = !!value;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Sync highlight to current value when opening
  useEffect(() => {
    if (open) setActiveIdx(options.findIndex((o) => o.value === value));
  }, [open, value, options]);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      commit(options[activeIdx].value);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`relative ${minWidthClass} ${className}`}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`
          group flex w-full items-center justify-between gap-3 rounded-xl
          border px-4 py-2.5 text-sm transition-all duration-300
          ${
            isFiltered
              ? "border-emerald-400/40 bg-emerald-400/[0.06] text-white shadow-[0_0_24px_-10px_rgba(16,185,129,0.7)]"
              : "border-white/10 bg-black/40 text-slate-200 hover:border-white/20"
          }
          ${open ? "ring-2 ring-emerald-400/40" : "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"}
        `}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.dot && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot} shadow-[0_0_8px_currentColor]`} />
          )}
          {icon && !selected?.dot && (
            <Icon icon={icon} className="shrink-0 text-base text-slate-400" />
          )}
          <span className="truncate font-medium">
            {selected ? (
              <>
                {prefix && <span className="text-slate-500">{prefix} </span>}
                {selected.label}
              </>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
          </span>
        </span>
        <Icon
          icon="solar:alt-arrow-down-line-duotone"
          className={`shrink-0 text-base text-slate-400 transition-transform duration-300 ${open ? "rotate-180 text-emerald-300" : ""}`}
        />
      </button>

      {/* Panel */}
      <div
        role="listbox"
        className={`
          absolute left-0 right-0 z-50 mt-2 origin-top overflow-hidden rounded-xl
          border border-white/10 bg-[#0a0c12]/95 p-1.5 backdrop-blur-2xl
          shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)]
          transition-all duration-200 ease-out
          ${open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"}
        `}
      >
        {/* top accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {options.map((opt, idx) => {
            const isSel = opt.value === value;
            const isActive = idx === activeIdx;
            return (
              <button
                key={opt.value || "__all"}
                type="button"
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => commit(opt.value)}
                className={`
                  flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150
                  ${isActive ? "bg-white/[0.07]" : "bg-transparent"}
                  ${isSel ? "text-white" : "text-slate-300"}
                `}
              >
                {opt.dot ? (
                  <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot} shadow-[0_0_8px_currentColor]`} />
                ) : opt.icon ? (
                  <Icon icon={opt.icon} className="shrink-0 text-base text-slate-400" />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-white/15" />
                )}
                <span className="flex-1 truncate text-left font-medium">{opt.label}</span>
                {isSel && (
                  <Icon
                    icon="solar:check-circle-bold"
                    className="shrink-0 text-base text-emerald-400"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
