"use client";

import React, { useEffect } from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { CAT_DESIGN, ACTION_CLS, LEAD_TEMP_CFG } from "./constants";
import { TASK_TYPE_CFG, getTaskType, type TaskType } from "./taskType";
import { TaskTypeBody } from "./TaskTypeBody";
import { SlaBadge } from "./SlaBadge";
import { fIDR } from "./helpers";
import type { DailyTask } from "./types";

const isDone = (t: DailyTask) => t.done || ((t.current ?? 0) >= (t.target ?? 1));
const INTERACTIVE: TaskType[] = ["HUBUNGI_WA", "TITIP_JUAL", "POST_LISTING", "FOLLOWUP", "AJUKAN_PENAWARAN", "COBROKE"];

function MetaItem({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon icon={icon} className="text-[13px] text-slate-500" />
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</span>
      </div>
      <p className={`text-[12.5px] font-bold ${accent ?? "text-slate-200"}`}>{value}</p>
    </div>
  );
}

export function TaskDetailSheet({
  task,
  onClose,
  onToggleDone,
}: {
  task: DailyTask;
  onClose: () => void;
  onToggleDone: () => void;
}) {
  const D = CAT_DESIGN[task.category];
  const type = getTaskType(task);
  const cfg = TASK_TYPE_CFG[type];
  const done = isDone(task);
  const hasBody = INTERACTIVE.includes(type) && !done;
  const isBatch = task.target !== undefined;
  const pct = done ? 100 : isBatch ? Math.min(100, ((task.current ?? 0) / (task.target ?? 1)) * 100) : 0;

  // Esc to close + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const metas: { icon: string; label: string; value: string; accent?: string }[] = [];
  if (task.leadName) metas.push({ icon: "solar:user-rounded-bold", label: "Kontak", value: task.leadName });
  if (task.leadPhone) metas.push({ icon: "solar:phone-bold", label: "Nomor", value: task.leadPhone });
  if (task.scheduledAt) metas.push({ icon: "solar:clock-circle-bold", label: "Jadwal", value: `Hari ini · ${task.scheduledAt}` });
  if (task.pipelineStage) metas.push({ icon: "solar:layers-minimalistic-bold", label: "Tahap", value: task.pipelineStage });
  if (task.propertyTitle) metas.push({ icon: "solar:home-2-bold", label: "Properti", value: task.propertyTitle });
  if (task.commissionValue) metas.push({ icon: "solar:wallet-money-bold", label: "Komisi", value: fIDR(task.commissionValue), accent: "text-emerald-300" });

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      {/* Panel */}
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0a0c12] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)] sm:rounded-3xl"
      >
        {/* Accent bar by category */}
        <div className="h-1 w-full shrink-0" style={{ background: D?.iconGrad }} />

        {/* ambient glow */}
        <div className="pointer-events-none absolute -right-16 -top-12 h-48 w-48 rounded-full blur-3xl opacity-25" style={{ background: D?.orb }} />

        {/* Header */}
        <div className="relative flex items-start gap-3 px-5 pt-5 pb-4 sm:px-6">
          {/* mobile grab handle */}
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/15 sm:hidden" />

          <div
            className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${D?.iconRing} ${D?.iconShadow}`}
            style={{ background: D?.iconGrad }}
          >
            <Icon icon={cfg.icon} className="text-xl text-white drop-shadow" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-[0.16em] ${cfg.tint}`}>{cfg.label}</span>
              {task.deadline && !done && <SlaBadge deadline={task.deadline} size="md" />}
              {task.overdue && !done && (
                <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/35 bg-rose-500/[0.12] px-1.5 py-0.5 text-[8.5px] font-black text-rose-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
                  </span>
                  OVERDUE
                </span>
              )}
              {done && (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-black text-emerald-400">
                  <Icon icon="solar:check-circle-bold" className="text-[10px]" /> SELESAI
                </span>
              )}
            </div>
            <h2 className="mt-1 text-[16px] font-extrabold leading-snug text-white">{task.title}</h2>
            <p className="mt-1 text-[11.5px] text-slate-500">{cfg.tagline}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Icon icon="solar:close-circle-bold" className="text-lg" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="relative flex-1 space-y-4 overflow-y-auto px-5 pb-4 sm:px-6">
          {/* Why */}
          {task.why && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Icon icon="solar:lightbulb-bold-duotone" className="text-sm text-amber-300" />
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Kenapa Penting</span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-slate-300">{task.why}</p>
            </div>
          )}

          {/* Meta grid */}
          {metas.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {metas.map((m) => (
                <MetaItem key={m.label} {...m} />
              ))}
            </div>
          )}

          {/* Lead temperature */}
          {task.leadTemp && (() => {
            const lt = LEAD_TEMP_CFG[task.leadTemp!];
            return (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Suhu lead</span>
                <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${lt.cls}`}>
                  <Icon icon={lt.icon} className="text-[11px]" />{lt.label}
                </span>
              </div>
            );
          })()}

          {/* Progress */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Progress</span>
              <span className={`text-[11px] font-extrabold tabular-nums ${done ? "text-emerald-400" : D?.accent}`}>
                {isBatch ? `${task.current ?? 0}/${task.target}` : done ? "100%" : "0%"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ background: done ? "linear-gradient(90deg,#059669,#34d399)" : D?.iconGrad }}
              />
            </div>
          </div>

          {/* Interactive type-specific body, or playbook fallback */}
          {hasBody ? (
            <TaskTypeBody
              task={task}
              type={type}
              tint={cfg.tint}
              onDone={() => { onToggleDone(); onClose(); }}
            />
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <Icon icon="solar:checklist-minimalistic-bold-duotone" className={`text-sm ${cfg.tint}`} />
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Langkah {cfg.label}</span>
              </div>
              <ol className="space-y-2.5">
                {cfg.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-black ${cfg.tint}`}>
                      {i + 1}
                    </span>
                    <span className="text-[12px] leading-relaxed text-slate-300">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer actions (sticky) */}
        <div className="shrink-0 border-t border-white/[0.07] bg-[#0a0c12]/95 px-5 py-3.5 backdrop-blur-xl sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {!done && !hasBody &&
              task.actions
                .filter((a) => a.variant !== "primary")
                .map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.onClick}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold transition-all duration-150 ${ACTION_CLS[a.variant] ?? ACTION_CLS.ghost}`}
                  >
                    <Icon icon={a.icon} className="text-sm" />
                    {a.label}
                  </button>
                ))}

            <button
              type="button"
              onClick={() => { onToggleDone(); onClose(); }}
              className={[
                "ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all duration-200",
                done
                  ? "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  : "text-white",
              ].join(" ")}
              style={
                done
                  ? undefined
                  : {
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      boxShadow: "0 4px 20px -8px rgba(16,185,129,0.9), inset 0 1px 0 rgba(255,255,255,0.14)",
                    }
              }
            >
              <Icon icon={done ? "solar:restart-bold" : "solar:check-circle-bold"} className="text-base" />
              {done ? "Buka kembali" : "Tandai selesai"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
