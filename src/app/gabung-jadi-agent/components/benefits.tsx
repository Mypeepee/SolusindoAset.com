"use client";

import React from "react";

export default function BenefitsSection() {
  return (
    <aside className="lg:col-span-5">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
        <h2 className="text-base font-semibold">Benefit utama</h2>

        <div className="mt-5 space-y-3">
          <BenefitRow icon={<IconDatabase />} title="Database listing nasional" desc="Mulai prospek tanpa harus canvassing." />
          <BenefitRow icon={<IconReward />} title="Bonus & reward closing" desc="Komisi + apresiasi (poin/reward)." />
          <BenefitRow icon={<IconUsers />} title="Struktur tim & mentoring" desc="Terhubung ke upline untuk support & growth." />
          <BenefitRow icon={<IconChart />} title="Dashboard performa" desc="Pantau transaksi & progres secara rapi." />
          <BenefitRow icon={<IconShield />} title="Profil terverifikasi" desc="Meningkatkan trust klien." />
        </div>
      </div>
    </aside>
  );
}

function BenefitRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.04] transition">
      <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-emerald-200">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-white/60">{desc}</div>
      </div>
    </div>
  );
}

/* ---- Icons (duplikasi aman) ---- */

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
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M12 2 20 6v7c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-4Z" stroke="currentColor" strokeWidth="2" />
      <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
