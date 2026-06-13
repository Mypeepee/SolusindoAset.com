"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { CAT_DESIGN, ACTION_CLS, LEAD_TEMP_CFG } from "./constants";
import { fIDR } from "./helpers";
import type { DailyTask } from "./types";

export function TaskCard({ task, onToggle }: { task: DailyTask; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const D       = CAT_DESIGN[task.category];
  const isBatch = task.target !== undefined;
  const isDone  = task.done || (isBatch && (task.current ?? 0) >= (task.target ?? 1));
  const pct     = isDone ? 100 : isBatch ? Math.min(100, ((task.current ?? 0) / (task.target ?? 1)) * 100) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: isDone ? 0.4 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, height: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 cursor-default",
        isDone
          ? "border-white/[0.05] bg-white/[0.015]"
          : "border-white/[0.09] hover:border-white/[0.18] hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,.7)]",
      ].join(" ")}
      style={{ background: isDone ? undefined : D.grad }}
    >
      {/* ── decorative ── */}
      {!isDone && <>
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${D.hairline} to-transparent`} />
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl opacity-60 group-hover:opacity-90 transition-opacity duration-700"
          style={{ background: D.orb }} />
        {/* shimmer sweep */}
        <div className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.035] to-transparent opacity-0 transition-all duration-[1.2s] ease-out group-hover:left-[130%] group-hover:opacity-100" />
      </>}

      <div className="relative flex flex-col flex-1 p-5 gap-3">

        {/* ── Row 1: date/time + status badge ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Category icon small */}
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ring-1 ${D.iconRing} transition-transform duration-300 group-hover:scale-105`}
              style={{ background: isDone ? "rgba(255,255,255,0.04)" : D.iconGrad }}
            >
              <Icon icon={D.icon} className="text-xs text-white" />
            </div>
            {/* Date / scheduled */}
            <span className="text-[10px] font-semibold text-slate-500">
              {task.scheduledAt ? `Hari ini · ${task.scheduledAt}` : "Hari ini"}
            </span>
          </div>

          {/* Status badge */}
          {task.overdue && !isDone && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/[0.12] px-2 py-0.5 text-[9.5px] font-extrabold text-rose-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
              </span>
              OVERDUE
            </span>
          )}
          {isDone && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold text-emerald-400">
              <Icon icon="solar:check-circle-bold" className="text-[10px]" /> Selesai
            </span>
          )}
          {!task.overdue && !isDone && task.commissionValue && (
            <span className="text-[10.5px] font-extrabold text-emerald-400 tabular-nums">
              {fIDR(task.commissionValue)}
            </span>
          )}
        </div>

        {/* ── Row 2: title ── */}
        <div>
          <h3 className={`text-[13.5px] font-bold leading-snug ${isDone ? "line-through text-slate-500" : "text-white"}`}>
            {task.title}
          </h3>
          <p className={`text-[10.5px] mt-0.5 ${D.chipText} font-semibold`}>{D.label}</p>
        </div>

        {/* ── Row 3: meta chips ── */}
        {!isDone && (task.leadTemp || task.pipelineStage || task.propertyTitle) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {task.leadTemp && (() => {
              const t = LEAD_TEMP_CFG[task.leadTemp!];
              return (
                <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9.5px] font-bold ${t.cls}`}>
                  <Icon icon={t.icon} className="text-[9px]" />{t.label}
                </span>
              );
            })()}
            {task.pipelineStage && (
              <span className="text-[9.5px] font-semibold text-slate-400 border border-white/[0.08] bg-white/[0.03] rounded-lg px-2 py-0.5">
                {task.pipelineStage}
              </span>
            )}
            {task.propertyTitle && (
              <span className="text-[9.5px] text-slate-500 flex items-center gap-0.5 max-w-[120px] truncate">
                <Icon icon="solar:home-2-bold" className="text-[9px] shrink-0" />{task.propertyTitle}
              </span>
            )}
          </div>
        )}

        {/* ── Row 4: progress bar ── */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-slate-600">Progress</span>
            <span className={`text-[10px] font-extrabold tabular-nums ${isDone ? "text-emerald-400" : D.accent}`}>
              {isBatch ? `${task.current ?? 0}/${task.target}` : isDone ? "100%" : "0%"}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{
                background: isDone
                  ? "linear-gradient(90deg,#059669,#34d399)"
                  : D.iconGrad,
                boxShadow: isDone ? "0 0 8px rgba(52,211,153,.4)" : undefined,
              }}
            />
          </div>
        </div>

        {/* ── Row 5: actions (collapsed by default, expand on click) ── */}
        {!isDone && (
          <>
            <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.06]">
              {/* Quick primary actions (icon-only buttons) */}
              <div className="flex items-center gap-1.5">
                {task.actions.slice(0, 3).map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.onClick}
                    title={a.label}
                    className={`flex h-7 w-7 items-center justify-center rounded-xl border transition-all duration-150 ${ACTION_CLS[a.variant] ?? ACTION_CLS.ghost}`}
                  >
                    <Icon icon={a.icon} className="text-sm" />
                  </button>
                ))}
                {task.actions.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => !p)}
                    className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-500 hover:text-white hover:bg-white/[0.07] transition-all duration-150"
                    title={expanded ? "Tutup" : "Lihat semua aksi"}
                  >
                    <Icon icon={expanded ? "solar:alt-arrow-up-bold" : "solar:menu-dots-bold"} className="text-sm" />
                  </button>
                )}
              </div>

              {/* Checkbox / mark done */}
              <button
                type="button"
                onClick={onToggle}
                className={[
                  "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold transition-all duration-200",
                  task.overdue
                    ? "border-rose-400/30 bg-rose-500/[0.08] text-rose-300 hover:bg-rose-500/15"
                    : "border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-400 hover:bg-emerald-500/15",
                ].join(" ")}
              >
                <Icon icon="solar:check-circle-bold" className="text-sm" />
                Selesai
              </button>
            </div>

            {/* Expanded actions + why */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2.5 space-y-2.5">
                    <p className="text-[10.5px] text-slate-500 leading-relaxed">
                      💡 {task.why}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {task.actions.map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          onClick={a.onClick}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10.5px] font-bold transition-all duration-150 ${ACTION_CLS[a.variant] ?? ACTION_CLS.ghost}`}
                        >
                          <Icon icon={a.icon} className="text-sm" />
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Done state: simple re-open option */}
        {isDone && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-auto flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 hover:text-slate-400 transition-colors pt-2 border-t border-white/[0.04]"
          >
            <Icon icon="solar:restart-bold" className="text-xs" /> Buka kembali
          </button>
        )}
      </div>
    </motion.div>
  );
}
