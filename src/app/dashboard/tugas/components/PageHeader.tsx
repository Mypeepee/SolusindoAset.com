"use client";

import React from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Icon } from "@iconify/react";
import { useCountUp } from "./helpers";
import type { DailyTask } from "./types";

export function PageHeader({ tasks, totalDone }: { tasks: DailyTask[]; totalDone: number }) {
  const { data: session } = useSession();
  const today = new Date();

  const DAYS   = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  const pct        = tasks.length > 0 ? (totalDone / tasks.length) * 100 : 0;
  const animPct    = useCountUp(pct);
  const urgentLeft = tasks.filter((t) => t.category === "URGENT" && !t.done).length;

  /* ring changes to green when 100% */
  const ringColor = pct >= 100 ? "#34d399" : "#fb923c";
  const ringGlow  = pct >= 100 ? "rgba(52,211,153,.6)"  : "rgba(251,146,60,.6)";

  const statusLabel =
    pct === 100 ? "Semua selesai! 🏆" :
    pct >= 75   ? "Hampir tuntas!" :
    pct >= 50   ? "Setengah jalan" :
    "Mulai dari URGENT";

  return (
    /* Negative margin to escape layout's px-4/px-5, then re-apply same padding inside */
    <div className="-mx-4 sm:-mx-5 pt-0 pb-4">
      <div className="grid grid-cols-4 gap-0 items-stretch px-4 sm:px-5 pt-4 gap-x-4">

        {/* ══════════════════════════════════
            BANNER  col-span-3
        ══════════════════════════════════ */}
        <div
          className="col-span-3 relative overflow-hidden rounded-2xl min-h-[156px] flex items-center"
          style={{
            background: "linear-gradient(125deg, #1c0d00 0%, #180a00 30%, #0f0800 55%, #080c14 80%, #060810 100%)",
            border: "1px solid rgba(251,146,60,0.22)",
          }}
        >
          {/* ── ambient glow layers ── */}
          <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-orange-600/[0.2] blur-[70px]" />
          <div className="pointer-events-none absolute top-0 left-1/3 h-32 w-48 rounded-full bg-amber-500/[0.08] blur-[50px]" />
          <div className="pointer-events-none absolute -bottom-14 right-36 h-40 w-40 rounded-full bg-orange-400/[0.06] blur-[40px]" />

          {/* Dot grid */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(251,146,60,0.22) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              maskImage: "linear-gradient(to right, transparent 0%, black 15%, black 70%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 15%, black 70%, transparent 100%)",
            }}
          />
          {/* Top hairline */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/70 to-transparent" />
          {/* Bottom hairline */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-400/20 to-transparent" />
          {/* Corner bracket TL */}
          <div className="pointer-events-none absolute top-4 left-4 h-5 w-5 border-t-[1.5px] border-l-[1.5px] border-orange-400/40 rounded-tl-sm" />
          {/* Corner bracket BR */}
          <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-[1.5px] border-r-[1.5px] border-orange-400/20 rounded-br-sm" />

          {/* ── content ── */}
          <div className="relative z-10 flex items-center justify-between w-full px-8 py-6 gap-6">

            {/* Left: text */}
            <div className="min-w-0 flex-1">
              {/* Live badge + date */}
              <div className="flex items-center gap-2.5 mb-3">
                <span className="relative flex h-[6px] w-[6px] shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-orange-400" />
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.34em] text-orange-400/80 select-none">
                  {DAYS[today.getDay()]}&nbsp;&nbsp;·&nbsp;&nbsp;{today.getDate()} {MONTHS[today.getMonth()]} {today.getFullYear()}
                </span>
              </div>

              {/* Headline */}
              <h1
                className="text-[1.85rem] font-black tracking-tight leading-[1.08] mb-2 bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #ffffff 0%, #fde68a 45%, #fb923c 100%)" }}
              >
                Tugas Hari Ini
              </h1>

              {/* Subtitle */}
              <p className="text-[12.5px] text-slate-400 leading-relaxed">
                Halo,{" "}
                <span className="font-semibold text-orange-300">
                  {session?.user?.name || "Agen"}
                </span>
                . Cek tugas &amp; jadwal harimu hari ini.
              </p>

              {/* CTA */}
              <button
                type="button"
                onClick={() => document.getElementById("sec-URGENT")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="mt-4 group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold text-white transition-all duration-200 select-none"
                style={{
                  background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
                  boxShadow: "0 4px 22px -6px rgba(234,88,12,0.80), inset 0 1px 0 rgba(255,255,255,0.14)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 6px 30px -4px rgba(234,88,12,1), inset 0 1px 0 rgba(255,255,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 4px 22px -6px rgba(234,88,12,0.80), inset 0 1px 0 rgba(255,255,255,0.14)";
                }}
              >
                <Icon icon="solar:calendar-mark-bold-duotone" className="text-sm text-orange-200" />
                Jadwal hari ini
                <Icon icon="solar:arrow-right-bold" className="text-xs text-orange-300 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* Right: illustration */}
            <div className="relative shrink-0 self-end select-none pointer-events-none">
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 h-12 w-36 rounded-full bg-orange-500/15 blur-2xl" />
              <Image
                src="/images/hero/multitasking.png"
                alt=""
                width={220}
                height={160}
                className="relative h-[160px] w-auto object-contain"
                style={{
                  filter:
                    "drop-shadow(0 14px 36px rgba(234,88,12,0.30)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
                }}
                priority
              />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════
            PROGRESS CARD  col-span-1
        ══════════════════════════════════ */}
        <div
          className="col-span-1 relative overflow-hidden rounded-2xl flex flex-col items-center justify-center gap-3.5 px-5 py-6"
          style={{
            background: "linear-gradient(160deg, #0f1118 0%, #090d14 55%, #060810 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Orb */}
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl opacity-[0.12]"
            style={{ background: ringColor }}
          />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <p className="text-[8px] font-black uppercase tracking-[0.28em] text-slate-600 w-full text-center">
            Progress Hari Ini
          </p>

          {/* Animated ring */}
          <div className="relative h-[90px] w-[90px] shrink-0">
            <div
              className="pointer-events-none absolute inset-2 rounded-full blur-2xl opacity-25 transition-all duration-700"
              style={{ background: ringColor }}
            />
            <svg className="h-[90px] w-[90px] -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
              <circle
                cx="40" cy="40" r="32" fill="none"
                stroke={ringColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${(animPct / 100) * 201} 201`}
                style={{
                  filter: `drop-shadow(0 0 8px ${ringGlow})`,
                  transition: "stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1), stroke 0.5s ease",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[1.35rem] font-black text-white tabular-nums leading-none">
                {Math.round(animPct)}%
              </span>
              <span className="text-[7px] text-slate-500 uppercase tracking-[0.2em] mt-0.5">selesai</span>
            </div>
          </div>

          {/* Count */}
          <div className="text-center">
            <p className="text-[1.75rem] font-black tabular-nums leading-none" style={{ color: ringColor }}>
              {totalDone}
              <span className="text-[1rem] font-semibold text-slate-500">/{tasks.length}</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">tugas selesai</p>
          </div>

          {/* Status pill */}
          <div
            className="w-full text-center rounded-xl px-3 py-2 text-[10px] font-bold leading-snug"
            style={{
              background: pct >= 100 ? "rgba(52,211,153,0.09)" : "rgba(251,146,60,0.08)",
              border:     pct >= 100 ? "1px solid rgba(52,211,153,0.22)" : "1px solid rgba(251,146,60,0.2)",
              color:      pct >= 100 ? "#34d399" : "#fb923c",
            }}
          >
            {statusLabel}
          </div>

          {/* Urgent alert */}
          {urgentLeft > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
              </span>
              <span className="text-[9.5px] font-bold text-rose-300">{urgentLeft} mendesak</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
