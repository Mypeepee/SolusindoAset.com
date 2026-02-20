"use client";

import React from "react";
import { Icon } from "@iconify/react";

export default function HeroSection({
  isAuthed,
  onStart,
  prefillLoading,
  existingAgentStatus,
}: {
  isAuthed: boolean;
  onStart: () => void;
  prefillLoading: boolean;
  existingAgentStatus: string | null;
}) {
  return (
    <div className="mb-10 grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70">
          <span className="text-emerald-200">●</span> Upgrade Agent • 3 langkah • ± 2–3 menit
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
          Aktifkan status <span className="text-emerald-200">Agent Profesional</span>
        </h1>

        <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
          Akses database listing nasional, sistem reward closing, mentoring tim, dan dashboard performa.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onStart}
            disabled={!isAuthed}
            className={[
              "rounded-2xl px-5 py-3 text-sm font-medium transition",
              isAuthed ? "bg-emerald-400/90 text-black hover:bg-emerald-300" : "bg-white/10 text-white/60 cursor-not-allowed",
            ].join(" ")}
          >
            {isAuthed ? "Mulai Pendaftaran" : "Login untuk Mulai"}
          </button>

          <div className="text-xs text-white/50">🔒 Dokumen hanya untuk verifikasi.</div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatChip title="100.000+" sub="Listing nasional" icon={<IconDatabase />} />
            <StatChip title="Reward" sub="Bonus tiap closing" icon={<IconReward />} />
            <StatChip title="Mentoring" sub="Upline & support" icon={<IconUsers />} />
            <StatChip title="Dashboard" sub="Tracking performa" icon={<IconChart />} />
          </div>

          {prefillLoading ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/60 flex items-center gap-2">
              <Icon icon="line-md:loading-loop" /> Mengecek status pendaftaran kamu...
            </div>
          ) : existingAgentStatus ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <div className="text-xs text-emerald-100/80">Status pendaftaran</div>
              <div className="mt-1 text-sm font-medium text-white">{String(existingAgentStatus || "PENDING")}</div>
              <div className="mt-1 text-xs text-white/70">
                Pendaftaran sudah tercatat.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---- UI kecil yg dipakai Hero ---- */

function StatChip({ title, sub, icon }: { title: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-emerald-200">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-white/55">{sub}</div>
        </div>
      </div>
    </div>
  );
}

/* ---- Icons (duplikasi aman, tidak mengubah UI) ---- */

function IconDatabase() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M4 6c0-2 3.6-3.6 8-3.6S20 4 20 6s-3.6 3.6-8 3.6S4 8 4 6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M4 6v6c0 2 3.6 3.6 8 3.6s8-1.6 8-3.6V6" stroke="currentColor" strokeWidth="2" />
      <path d="M4 12v6c0 2 3.6 3.6 8 3.6s8-1.6 8-3.6v-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconReward() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M7 6H5a2 2 0 0 0 0 4h2" stroke="currentColor" strokeWidth="2" />
      <path d="M17 6h2a2 2 0 0 1 0 4h-2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 15v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 15V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 15v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
