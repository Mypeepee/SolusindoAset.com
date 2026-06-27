"use client";

/**
 * TypePicker — pemilih Tipe Aset (kategori properti) multi-select.
 * Dipakai bersama oleh Home, Jual, Lelang, dan halaman kategori.
 *
 * Panel di-portal ke body (lepas dari stacking/transform induk) dan lebarnya
 * di-clamp ke viewport supaya tak pernah meluber. Animasi buka & tutup
 * (AnimatePresence) ikut diputar.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

type Theme = "light" | "dark";

interface TypePickerProps {
  value: string[]; // nama tampilan, mis. ["Rumah", "Tanah"]
  onChange: (next: string[]) => void;
  options: string[]; // nama tampilan yang tersedia
  icons?: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme?: Theme;
  label?: string;
}

interface ThemeTokens {
  triggerLabel: string;
  triggerValue: string;
  triggerIcon: string;
  panel: string;
  header: string;
  bodyBg: string;
  title: string;
  nameIdle: string;
  rowHover: string;
  checkboxIdle: string;
  footer: string;
  resetBtn: string;
}

const THEMES: Record<Theme, ThemeTokens> = {
  light: {
    triggerLabel: "text-gray-400 group-hover:text-primary",
    triggerValue: "text-gray-800",
    triggerIcon: "text-gray-400 group-hover:text-primary",
    panel: "bg-white border-gray-100",
    header: "bg-gray-50 border-gray-100",
    bodyBg: "bg-white",
    title: "text-gray-800",
    nameIdle: "text-gray-700",
    rowHover: "hover:bg-gray-50",
    checkboxIdle: "border-gray-300 bg-white",
    footer: "bg-gray-50 border-gray-100",
    resetBtn: "text-gray-500 hover:text-red-500 hover:bg-red-50",
  },
  dark: {
    triggerLabel: "text-gray-400 group-hover:text-primary",
    triggerValue: "text-white",
    triggerIcon: "text-gray-400 group-hover:text-primary",
    panel: "bg-[#222] border-white/10",
    header: "bg-[#2A2A2A] border-white/10",
    bodyBg: "bg-[#1A1A1A]",
    title: "text-white",
    nameIdle: "text-gray-300",
    rowHover: "hover:bg-white/5",
    checkboxIdle: "border-gray-600 bg-transparent",
    footer: "bg-[#2A2A2A] border-white/10",
    resetBtn: "text-gray-400 hover:text-red-400 hover:bg-red-500/10",
  },
};

export default function TypePicker({
  value,
  onChange,
  options,
  icons,
  open,
  onOpenChange,
  theme = "light",
  label = "Tipe Aset",
}: TypePickerProps) {
  const t = THEMES[theme];

  const triggerRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  const summary =
    value.length === 0
      ? "Semua Tipe"
      : value.length === 1
      ? value[0]
      : `${value[0]} +${value.length - 1}`;

  // posisi panel (fixed, ter-clamp ke viewport)
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Lebar panel = lebar trigger (min 260px, max 300px) — BUKAN berbasis viewport
  const PANEL_W = Math.min(300, Math.max(rect?.width ?? 260, 260));
  const rawLeft = rect ? rect.left : 8;
  const left = Math.max(8, rawLeft + PANEL_W > vw - 8 ? vw - PANEL_W - 8 : rawLeft);
  // Buka ke atas jika ruang bawah < 280px dan ruang atas lebih banyak
  const spaceBelow = rect ? vh - rect.bottom - 16 : 400;
  const spaceAbove = rect ? rect.top - 16 : 400;
  const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
  const maxH = Math.max(240, Math.min(440, openUpward ? spaceAbove : spaceBelow));
  const top = openUpward
    ? (rect?.top ?? 0) - maxH - 8
    : (rect?.bottom ?? 0) + 8;

  const panel = mounted
    ? createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="typepanel"
              data-search-portal="true"
              initial={{ opacity: 0, y: openUpward ? -8 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: openUpward ? -8 : 8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top,
                left,
                width: PANEL_W,
                maxHeight: maxH,
                zIndex: 99999,
              }}
              className={`rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${t.panel}`}
            >
              <div
                className={`px-4 py-3 border-b ${t.header} flex items-center justify-between shrink-0`}
              >
                <h4 className={`font-bold ${t.title} text-sm flex items-center gap-2`}>
                  <Icon
                    icon="solar:buildings-bold-duotone"
                    className="text-primary text-lg"
                  />
                  Tipe Aset
                </h4>
              </div>

              <div className={`overflow-y-auto custom-scrollbar flex-1 p-2 ${t.bodyBg}`}>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                    value.length === 0
                      ? "bg-primary/10 text-primary"
                      : `${t.nameIdle} ${t.rowHover}`
                  }`}
                >
                  <Icon icon="solar:apps-bold-duotone" className="text-lg opacity-70 shrink-0" />
                  <span className="flex-1">Semua Tipe</span>
                  {value.length === 0 && (
                    <Icon icon="solar:check-circle-bold" className="text-primary text-lg" />
                  )}
                </button>

                {options.map((opt) => {
                  const checked = value.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggle(opt)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                        checked
                          ? "bg-primary/10 text-primary"
                          : `${t.nameIdle} ${t.rowHover}`
                      }`}
                    >
                      <Icon
                        icon={icons?.[opt] || "solar:home-bold-duotone"}
                        className="text-lg opacity-70 shrink-0"
                      />
                      <span className="flex-1 truncate">{opt}</span>
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          checked ? "bg-primary border-primary" : t.checkboxIdle
                        }`}
                      >
                        {checked && (
                          <Icon icon="solar:check-read-linear" className="text-white text-sm" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div
                className={`px-3 py-2.5 border-t ${t.footer} flex items-center justify-between gap-2 shrink-0`}
              >
                <button
                  type="button"
                  onClick={() => onChange([])}
                  disabled={value.length === 0}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${t.resetBtn}`}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-darkmode hover:bg-[#6ee7b7] transition-colors shadow-lg shadow-primary/30"
                >
                  Terapkan{value.length > 0 ? ` (${value.length})` : ""}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <div className="relative w-full h-full">
      <div
        ref={triggerRef}
        className="cursor-pointer h-full flex flex-col justify-center group"
        onClick={() => onOpenChange(!open)}
      >
        {label ? (
          <label
            className={`text-[10px] font-extrabold tracking-wider uppercase mb-1 block transition-colors ${t.triggerLabel}`}
          >
            {label}
          </label>
        ) : null}
        <div className="flex items-center gap-2 w-full">
          <Icon
            icon="solar:buildings-bold-duotone"
            className={`text-xl shrink-0 transition-colors ${t.triggerIcon}`}
          />
          <p className={`font-bold text-sm truncate flex-1 ${t.triggerValue}`}>{summary}</p>
          <Icon
            icon="solar:alt-arrow-down-linear"
            className={`shrink-0 transition-transform ${t.triggerIcon} ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>
      {panel}
    </div>
  );
}
