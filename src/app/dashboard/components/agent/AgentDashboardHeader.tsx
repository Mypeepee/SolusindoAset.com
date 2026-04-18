"use client";

import { Icon } from "@iconify/react";
import { formatDayLong } from "./utils";

function getGreeting(): { text: string; icon: string } {
  const h = new Date().getHours();
  if (h < 5)  return { text: "Selamat Malam",  icon: "solar:moon-stars-bold-duotone" };
  if (h < 12) return { text: "Selamat Pagi",   icon: "solar:sun-fog-bold-duotone" };
  if (h < 15) return { text: "Selamat Siang",  icon: "solar:sun-bold-duotone" };
  if (h < 19) return { text: "Selamat Sore",   icon: "solar:sun-2-bold-duotone" };
  return       { text: "Selamat Malam",          icon: "solar:moon-stars-bold-duotone" };
}

export function AgentDashboardHeader({ userName }: { userName?: string | null }) {
  const today    = formatDayLong();
  const greeting = getGreeting();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-[#07090f]">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-sky-500/6 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-violet-500/5 blur-2xl" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

          {/* ── Left: greeting ── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon icon={greeting.icon} className="text-lg text-amber-300" />
              <p className="text-xs font-medium text-slate-400">{greeting.text} &mdash; {today}</p>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {userName
                ? <>Hi, <span className="text-emerald-300">{userName}</span> 👋</>
                : "Dashboard Agent Premier"}
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Fokus hari ini: <span className="text-white/80 font-medium">follow-up lead aktif</span>,
              konfirmasi <span className="text-white/80 font-medium">jadwal viewing</span>, dan dorong
              deal di tahap <span className="text-white/80 font-medium">negotiation</span> ke closing.
            </p>

            {/* Action hints */}
            <div className="mt-4 flex flex-wrap gap-2">
              <HintPill
                icon="solar:fire-bold-duotone"
                label="Cek hot leads"
                color="rose"
              />
              <HintPill
                icon="solar:calendar-mark-bold-duotone"
                label="Jadwal viewing hari ini"
                color="amber"
              />
              <HintPill
                icon="solar:hand-money-bold-duotone"
                label="Pipeline negotiation"
                color="sky"
              />
              <HintPill
                icon="solar:graph-up-bold-duotone"
                label="Update pipeline"
                color="emerald"
              />
            </div>
          </div>

          {/* ── Right: badges ── */}
          <div className="flex shrink-0 items-start gap-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 px-5 py-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">Status</p>
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <p className="text-sm font-bold text-white">Aktif</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/30 px-5 py-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Tier</p>
              <p className="mt-1.5 text-sm font-bold text-emerald-200">Premier</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function HintPill({
  icon,
  label,
  color,
}: {
  icon: string;
  label: string;
  color: "rose" | "amber" | "sky" | "emerald";
}) {
  const styles = {
    rose:    "border-rose-400/25 bg-rose-500/8 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/12",
    amber:   "border-amber-400/25 bg-amber-500/8 text-amber-300 hover:border-amber-400/50 hover:bg-amber-500/12",
    sky:     "border-sky-400/25 bg-sky-500/8 text-sky-300 hover:border-sky-400/50 hover:bg-sky-500/12",
    emerald: "border-emerald-400/25 bg-emerald-500/8 text-emerald-300 hover:border-emerald-400/50 hover:bg-emerald-500/12",
  };
  return (
    <span
      className={`inline-flex cursor-default items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${styles[color]}`}
    >
      <Icon icon={icon} className="text-sm" />
      {label}
    </span>
  );
}
