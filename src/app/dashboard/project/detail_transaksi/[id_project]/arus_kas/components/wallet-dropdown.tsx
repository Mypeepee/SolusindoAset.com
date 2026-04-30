"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileCheck2,
  Hammer,
  LayoutGrid,
  PiggyBank,
  ShieldCheck,
  Wallet2,
} from "lucide-react";
import type { WalletKey } from "../types";

type WalletOption = WalletKey | "all";

interface WalletDropdownProps {
  value: WalletOption;
  onChange: (value: WalletOption) => void;
}

const WALLET_CONFIG: Record<
  WalletOption,
  {
    label: string;
    Icon: React.ElementType;
    text: string;
    bg: string;
    border: string;
    dot: string;
  }
> = {
  all: {
    label: "Semua Dompet",
    Icon: LayoutGrid,
    text: "text-slate-200",
    bg: "bg-white/[0.06] hover:bg-white/[0.09]",
    border: "border-white/10",
    dot: "bg-slate-400",
  },
  utama: {
    label: "Dompet Utama",
    Icon: Wallet2,
    text: "text-emerald-200",
    bg: "bg-emerald-400/10 hover:bg-emerald-400/15",
    border: "border-emerald-300/20",
    dot: "bg-emerald-400",
  },
  dokumen: {
    label: "Dokumen",
    Icon: FileCheck2,
    text: "text-cyan-200",
    bg: "bg-cyan-400/10 hover:bg-cyan-400/15",
    border: "border-cyan-300/20",
    dot: "bg-cyan-400",
  },
  eksekusi: {
    label: "Eksekusi",
    Icon: ShieldCheck,
    text: "text-amber-200",
    bg: "bg-amber-400/10 hover:bg-amber-400/15",
    border: "border-amber-300/20",
    dot: "bg-amber-400",
  },
  renovasi: {
    label: "Renovasi",
    Icon: Hammer,
    text: "text-violet-200",
    bg: "bg-violet-400/10 hover:bg-violet-400/15",
    border: "border-violet-300/20",
    dot: "bg-violet-400",
  },
  cadangan: {
    label: "Cadangan",
    Icon: PiggyBank,
    text: "text-rose-200",
    bg: "bg-rose-400/10 hover:bg-rose-400/15",
    border: "border-rose-300/20",
    dot: "bg-rose-400",
  },
};

const OPTIONS: WalletOption[] = ["all", "utama", "dokumen", "eksekusi", "renovasi", "cadangan"];

export default function WalletDropdown({ value, onChange }: WalletDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selected = WALLET_CONFIG[value];
  const SelectedIcon = selected.Icon;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={[
          "flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition",
          selected.bg,
          selected.border,
          selected.text,
        ].join(" ")}
      >
        <SelectedIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">{selected.label}</span>
        <svg
          className={`ml-0.5 h-3 w-3 shrink-0 opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1120] shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {OPTIONS.map((key) => {
            const cfg = WALLET_CONFIG[key];
            const Icon = cfg.Icon;
            const isActive = key === value;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onChange(key); setOpen(false); }}
                className={[
                  "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition",
                  isActive
                    ? `${cfg.bg} ${cfg.text} font-medium`
                    : "text-slate-300 hover:bg-white/[0.05]",
                ].join(" ")}
              >
                <span className={["flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border", cfg.bg, cfg.border].join(" ")}>
                  <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                </span>
                <span className="flex-1 text-left">{cfg.label}</span>
                {isActive && (
                  <span className={["h-1.5 w-1.5 rounded-full", cfg.dot].join(" ")} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
