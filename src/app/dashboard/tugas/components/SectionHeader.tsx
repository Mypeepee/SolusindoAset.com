"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { CAT_DESIGN } from "./constants";
import type { Category } from "./types";

export function SectionHeader({ category, total, done }: { category: Category; total: number; done: number }) {
  const D = CAT_DESIGN[category];
  const pct = total > 0 ? (done / total) * 100 : 0;
  const allDone = done === total && total > 0;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${D.sectionBorder} bg-gradient-to-r ${D.sectionBg} px-5 py-4 mb-3`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${D.iconRing} ${D.iconShadow}`}
          style={{ background: D.iconGrad }}
        >
          <Icon icon={D.icon} className="text-base text-white drop-shadow" />
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 to-transparent opacity-60" />
        </div>

        {/* Label + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-extrabold tracking-tight ${D.accent}`}>{D.label}</span>
            {category === "URGENT" && !allDone && (
              <span className="flex h-2 w-2 relative">
                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
            )}
            {allDone && (
              <Icon icon="solar:check-circle-bold" className="text-sm text-emerald-400" />
            )}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-black/20 overflow-hidden">
              <motion.div
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`h-full rounded-full ${allDone ? "bg-emerald-500" : D.leftBar}`}
              />
            </div>
            <span className="text-[10px] font-extrabold text-slate-500 tabular-nums shrink-0">{done}/{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
