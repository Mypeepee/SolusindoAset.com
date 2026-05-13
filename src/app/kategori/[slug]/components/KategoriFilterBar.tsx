"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { SORT_OPTIONS } from "../constants";
import type { TabCounts } from "../types";

interface KategoriFilterBarProps {
  activeTipe: string;
  activeSort: string;
  tabCounts: TabCounts;
  onTipeChange: (tipe: string | undefined) => void;
  onSortChange: (sort: string) => void;
}

const TABS = [
  { key: "semua",  label: "Semua"  },
  { key: "jual",   label: "Jual"   },
  { key: "lelang", label: "Lelang" },
  { key: "sewa",   label: "Sewa"   },
] as const;

export default function KategoriFilterBar({
  activeTipe,
  activeSort,
  tabCounts,
  onTipeChange,
  onSortChange,
}: KategoriFilterBarProps) {
  return (
    <div className="sticky top-0 z-40 bg-[#0F0F0F]/95 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="container mx-auto max-w-screen-xl px-4">
        <div className="flex items-center gap-4 py-3 overflow-x-auto scrollbar-none">

          {/* Tabs dengan animated sliding background */}
          <div className="flex gap-1 shrink-0">
            {TABS.map((tab) => {
              const isActive =
                activeTipe === tab.key ||
                (tab.key === "semua" && activeTipe === "semua");
              const count = tabCounts[tab.key];

              return (
                <button
                  key={tab.key}
                  onClick={() =>
                    onTipeChange(tab.key === "semua" ? undefined : tab.key)
                  }
                  className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tab-bg"
                      className="absolute inset-0 bg-white/10 rounded-xl border border-white/15"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                  <span
                    className={`relative z-10 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-bold ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/5 text-white/25"
                    }`}
                  >
                    {count.toLocaleString("id-ID")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 shrink-0" />

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Icon
              icon="solar:sort-by-time-bold-duotone"
              className="text-white/25 text-sm"
            />
            <select
              value={activeSort}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-transparent border-none text-white/60 text-sm outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-4"
            >
              {SORT_OPTIONS.map((o) => (
                <option
                  key={o.value}
                  value={o.value}
                  className="bg-[#1a1a1a] text-white"
                >
                  {o.label}
                </option>
              ))}
            </select>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className="text-white/25 text-xs -ml-3 pointer-events-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
