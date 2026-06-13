"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { useCountUp, fIDR } from "./helpers";
import type { DailyTask } from "./types";

export function Sidebar({ tasks }: { tasks: DailyTask[] }) {
  const total = tasks.length;
  const done  = tasks.filter((t) => t.done || ((t.current ?? 0) >= (t.target ?? 1))).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const animPct = useCountUp(pct);

  const totalComm = tasks.filter((t) => !t.done && t.commissionValue)
    .reduce((s, t) => s + (t.commissionValue ?? 0), 0);
  const urgentLeft = tasks.filter((t) => t.category === "URGENT" && !t.done).length;
  const hotLeft    = tasks.filter((t) => t.leadTemp === "HOT" && !t.done).length;

  const statusMsg =
    pct === 100 ? "🏆 Semua task selesai! Hari yang luar biasa." :
    pct >= 75 ? "🔥 Hampir finish! Jangan berhenti sekarang." :
    pct >= 50 ? "💪 Setengah jalan. Keep going!" :
    "🎯 Fokus ke task URGENT & HOT leads dulu.";

  return (
    <div className="space-y-4">
      {/* Progress Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#0b1214] to-[#07090b] p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/[0.06] blur-2xl" />

        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-600 mb-4">Progress Hari Ini</p>

        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
              <circle cx="32" cy="32" r="26" fill="none"
                stroke={pct === 100 ? "#34d399" : "#38bdf8"} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(animPct / 100) * 163.4} 163.4`}
                className="drop-shadow-[0_0_8px_rgba(52,211,153,.5)] transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-white tabular-nums">{Math.round(animPct)}%</span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wider">selesai</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-3xl font-extrabold text-white tabular-nums leading-none">{done}</p>
            <p className="text-sm text-slate-500 mt-0.5">dari {total} task</p>
            {urgentLeft > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-2.5 py-1">
                <span className="flex h-1.5 w-1.5"><span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 opacity-75 animate-ping"/><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400"/></span>
                <span className="text-[10px] font-bold text-rose-300">{urgentLeft} mendesak</span>
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">{statusMsg}</p>
      </div>

      {/* Commission */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.09] to-emerald-900/[0.04] p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
        <div className="flex items-center gap-2 mb-2">
          <Icon icon="solar:wallet-money-bold-duotone" className="text-base text-emerald-300" />
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">Komisi Potensial</p>
        </div>
        <p className="text-2xl font-extrabold bg-gradient-to-br from-emerald-300 to-emerald-500 bg-clip-text text-transparent tabular-nums">
          {totalComm > 0 ? fIDR(totalComm) : "—"}
        </p>
        <p className="text-[10px] text-emerald-400/40 mt-0.5">dari task aktif hari ini</p>
      </div>

      {/* HOT leads */}
      {hotLeft > 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-rose-400/15 bg-gradient-to-br from-rose-500/[0.08] to-transparent p-5">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/25 to-transparent" />
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:fire-bold-duotone" className="text-base text-rose-300" />
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose-400/60">HOT Lead Aktif</p>
          </div>
          <p className="text-2xl font-extrabold text-rose-300 tabular-nums">{hotLeft}</p>
          <p className="text-[10px] text-rose-400/40 mt-0.5">belum dihubungi hari ini</p>
          <p className="mt-2 text-[11px] text-slate-500">Setiap jam tunda = peluang closing turun.</p>
        </div>
      )}

      {/* Streak */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#0b1012] to-[#07090b] p-5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/15 to-transparent" />
        <div className="flex items-center gap-2 mb-3">
          <Icon icon="solar:fire-bold-duotone" className="text-base text-amber-300" />
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Streak Produktif</p>
        </div>
        <p className="text-3xl font-extrabold text-amber-300 leading-none">7 <span className="text-base text-slate-500 font-semibold">hari</span></p>
        <div className="flex gap-1 mt-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < 7 ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-white/[0.05]"}`} />
          ))}
        </div>
        <p className="text-[11px] text-slate-600 mt-2">Pertahankan streak-mu!</p>
      </div>

      {/* Mindset */}
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.01] p-5">
        <div className="flex items-center gap-2 mb-2.5">
          <Icon icon="solar:lightbulb-bold-duotone" className="text-base text-amber-300" />
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Mindset Hari Ini</p>
        </div>
        <p className="text-[12px] text-slate-400 leading-relaxed italic">
          &ldquo;Tidak ada closing besar yang terjadi tanpa follow-up yang konsisten. Hubungi dulu, deal kemudian.&rdquo;
        </p>
      </div>
    </div>
  );
}
