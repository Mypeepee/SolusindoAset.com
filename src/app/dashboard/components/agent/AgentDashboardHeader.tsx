"use client";

import { Icon } from "@iconify/react";
import { formatDayLong } from "./utils";

/* ── Decorative orbital ring (right side) ──────────────────────────── */
function OrbitalRing() {
  return (
    <svg
      viewBox="0 0 220 220"
      className="absolute right-0 top-0 h-full w-auto opacity-[0.18] pointer-events-none"
      fill="none"
    >
      <circle cx="110" cy="110" r="100" stroke="url(#orb1)" strokeWidth="1" />
      <circle cx="110" cy="110" r="80"  stroke="url(#orb2)" strokeWidth="0.8" strokeDasharray="4 6" />
      <circle cx="110" cy="110" r="58"  stroke="url(#orb3)" strokeWidth="0.6" />
      <circle cx="110" cy="10"  r="4"   fill="#a78bfa" />
      <circle cx="202" cy="140" r="3"   fill="#fbbf24" />
      <circle cx="18"  cy="130" r="2.5" fill="#34d399" />
      <circle cx="150" cy="200" r="2"   fill="#38bdf8" />
      <defs>
        <linearGradient id="orb1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#a78bfa" />
          <stop offset="50%"  stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="orb2" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%"   stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="orb3" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Mesh noise texture ────────────────────────────────────────────── */
const NOISE_SVG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/* ── Stat pill — each its own accent color ─────────────────────────── */
function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent: { text: string; bg: string; border: string };
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border ${accent.border} ${accent.bg} px-3 py-2 backdrop-blur-sm`}
    >
      <Icon icon={icon} className={`text-base ${accent.text}`} />
      <span className="text-[11px] text-white/60">{label}</span>
      <span className={`text-xs font-bold ${accent.text}`}>{value}</span>
    </div>
  );
}

/* ── Public component ──────────────────────────────────────────────── */
export function AgentDashboardHeader({ userName }: { userName?: string | null }) {
  const today = formatDayLong();
  const name  = userName || "Premier";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  /* ── MOBILE pill ───────────────────────────────────────────────── */
  const MobilePill = (
    <div className="flex sm:hidden items-center gap-2.5 rounded-2xl border border-white/[0.07]
      bg-gradient-to-r from-[#0d0920] via-[#080c12] to-[#060e0a] px-3 py-2.5">
      {/* avatar */}
      <div className="relative flex-shrink-0 h-8 w-8 rounded-xl
        bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600
        flex items-center justify-center text-[11px] font-black text-black
        shadow-[0_0_14px_rgba(251,191,36,0.4)]">
        {initials}
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full
          bg-emerald-400 border-2 border-[#07090f]" />
      </div>
      {/* text */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate leading-none">{name}</p>
        <p className="mt-0.5 text-[10px] text-white/35 truncate leading-none">{today}</p>
      </div>
      {/* live */}
      <div className="flex-shrink-0 flex items-center gap-1.5 rounded-full
        border border-sky-400/25 bg-sky-500/10 px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
        <span className="text-[10px] font-semibold text-sky-300">Live</span>
      </div>
    </div>
  );

  /* ── DESKTOP card ──────────────────────────────────────────────── */
  const DesktopCard = (
    <div className="relative hidden sm:block overflow-hidden rounded-3xl border border-white/[0.07]"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 0% 0%, #1a0d3a 0%, transparent 55%)," +
          "radial-gradient(ellipse 60% 50% at 100% 0%, #0d2215 0%, transparent 50%)," +
          "radial-gradient(ellipse 50% 70% at 50% 100%, #0b1528 0%, transparent 60%)," +
          "linear-gradient(135deg, #07050f 0%, #070c0e 50%, #060810 100%)",
      }}
    >
      {/* colored glow blobs */}
      <div className="pointer-events-none absolute inset-0">
        {/* indigo/violet top-left */}
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full
          bg-violet-600/20 blur-3xl" />
        {/* gold/amber center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full
          bg-amber-400/8 blur-3xl" />
        {/* emerald bottom-left */}
        <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full
          bg-emerald-500/12 blur-3xl" />
        {/* sky/cyan top-right */}
        <div className="absolute -top-16 right-24 h-56 w-56 rounded-full
          bg-sky-500/12 blur-3xl" />
        {/* rose hint bottom-right */}
        <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full
          bg-rose-500/8 blur-3xl" />
      </div>

      {/* noise texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: NOISE_SVG }} />

      {/* top hairline — multi-color */}
      <div className="absolute top-0 inset-x-0 h-px
        bg-gradient-to-r from-violet-500/50 via-amber-400/40 to-emerald-400/50" />

      {/* decorative orbital SVG */}
      <OrbitalRing />

      {/* ── CONTENT ──────────────────────────────────────────────── */}
      <div className="relative px-8 py-7">
        <div className="flex items-center justify-between gap-6">

          {/* LEFT: avatar + greeting */}
          <div className="flex items-center gap-5 min-w-0">

            {/* avatar */}
            <div className="relative flex-shrink-0">
              {/* outer glow ring */}
              <div className="absolute -inset-1.5 rounded-[20px]
                bg-gradient-to-br from-violet-500/40 via-amber-400/30 to-emerald-400/30
                blur-sm" />
              <div className="relative h-16 w-16 rounded-2xl
                bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600
                flex items-center justify-center text-2xl font-black text-black
                shadow-[0_8px_24px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(255,255,255,0.3)]">
                {initials}
              </div>
              {/* online dot */}
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center
                rounded-full border-2 border-[#070510] bg-emerald-400
                shadow-[0_0_10px_rgba(52,211,153,0.8)]">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </div>

            {/* text */}
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
                {today}
              </p>
              <h1 className="mt-1 text-2xl lg:text-[2rem] font-extrabold tracking-tight text-white leading-none">
                Selamat datang,{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #fcd34d 0%, #fef3c7 45%, #fbbf24 80%, #d97706 100%)",
                  }}
                >
                  {name}
                </span>
              </h1>
              <p className="mt-2 text-sm text-white/40 max-w-lg leading-relaxed">
                Fokus hari ini: follow-up lead, atur jadwal viewing, dan dorong closing.
              </p>
            </div>
          </div>

          {/* RIGHT: mode + live chip */}
          <div className="hidden lg:flex flex-col items-end gap-2 flex-shrink-0">
            {/* work mode */}
            <div className="flex items-center gap-2.5 rounded-2xl
              border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 backdrop-blur-sm">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center
                bg-gradient-to-br from-violet-500/30 to-indigo-700/20
                border border-violet-400/25">
                <Icon icon="solar:bolt-circle-bold-duotone"
                  className="text-lg text-violet-300" />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-widest text-white/35">Mode</p>
                <p className="text-xs font-bold text-white">Work Mode</p>
              </div>
            </div>

            {/* live pill */}
            <div className="flex items-center gap-1.5 rounded-full
              border border-sky-400/20 bg-sky-500/[0.08] px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping
                  rounded-full bg-sky-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
              </span>
              <span className="text-[11px] font-semibold text-sky-300">Dashboard Live</span>
            </div>
          </div>
        </div>

        {/* bottom stat pills — 4 different accent colors */}
        <div className="mt-6 pt-5 border-t border-white/[0.05] flex flex-wrap items-center gap-2.5">
          <StatPill
            icon="solar:user-plus-bold-duotone"
            label="New Leads"
            value="28"
            accent={{ text: "text-sky-300", bg: "bg-sky-500/[0.07]", border: "border-sky-400/20" }}
          />
          <StatPill
            icon="solar:calendar-bold-duotone"
            label="Viewing"
            value="4"
            accent={{ text: "text-amber-300", bg: "bg-amber-500/[0.07]", border: "border-amber-400/20" }}
          />
          <StatPill
            icon="solar:hand-money-bold-duotone"
            label="Negotiation"
            value="3"
            accent={{ text: "text-violet-300", bg: "bg-violet-500/[0.07]", border: "border-violet-400/20" }}
          />
          <StatPill
            icon="solar:home-2-bold-duotone"
            label="Active Listing"
            value="13"
            accent={{ text: "text-emerald-300", bg: "bg-emerald-500/[0.07]", border: "border-emerald-400/20" }}
          />
          <StatPill
            icon="solar:graph-up-bold-duotone"
            label="Closing Rate"
            value="68%"
            accent={{ text: "text-rose-300", bg: "bg-rose-500/[0.07]", border: "border-rose-400/20" }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {MobilePill}
      {DesktopCard}
    </>
  );
}
