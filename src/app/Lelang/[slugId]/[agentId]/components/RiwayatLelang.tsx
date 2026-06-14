"use client";
import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import Signin from "@/components/Auth/SignIn";
import SignUp from "@/components/Auth/SignUp";

interface RiwayatItem {
  id_property: string;
  judul: string;
  harga: number;
  nilai_limit_lelang: number | null;
  tanggal_lelang: string | null;
  gambar_utama: string | null;
  status_tayang: string;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  legalitas: string | null;
  nomor_legalitas: string | null;
  slug: string;
}

const formatRupiah = (val: number | null | undefined) => {
  if (val == null || isNaN(val)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

const formatDate = (val: string | null) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  TERSEDIA: {
    label: "Tersedia",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  TERJUAL: {
    label: "Terjual",
    dot: "bg-blue-400",
    text: "text-blue-300",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  TIDAK_AKTIF: {
    label: "Tidak Aktif",
    dot: "bg-slate-500",
    text: "text-slate-400",
    bg: "bg-slate-700/30",
    border: "border-slate-600/20",
  },
};

const getStatus = (s: string) =>
  STATUS_CFG[s] ?? {
    label: s,
    dot: "bg-slate-500",
    text: "text-slate-400",
    bg: "bg-slate-700/30",
    border: "border-slate-600/20",
  };

export default function RiwayatLelang({
  idProperty,
  currentIdProperty,
}: {
  idProperty: string;
  currentIdProperty: string;
}) {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  useEffect(() => {
    if (!idProperty) return;
    fetch(`/api/listing/${idProperty}/riwayat-lelang`)
      .then((r) => r.json())
      .then((data) => setRiwayat(data.riwayat ?? []))
      .catch(() => setRiwayat([]))
      .finally(() => setLoading(false));
  }, [idProperty]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 space-y-4 animate-pulse">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/5" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-40 bg-white/5 rounded-lg" />
            <div className="h-3 w-24 bg-white/5 rounded-lg" />
          </div>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (riwayat.length < 1) return null;

  const legalitasLabel = riwayat[0]?.legalitas ?? "";
  const nomorLegalitas = riwayat[0]?.nomor_legalitas ?? "";
  const lokasiLabel = [riwayat[0]?.kelurahan, riwayat[0]?.kecamatan, riwayat[0]?.kota]
    .filter(Boolean)
    .join(", ");

  /* ── NOT LOGGED IN: premium FOMO paywall ─────────────── */
  if (!isLoggedIn) {
    const terjualCount = riwayat.filter((r) => r.status_tayang === "TERJUAL").length;
    const oldestYear = riwayat[riwayat.length - 1]?.tanggal_lelang
      ? new Date(riwayat[riwayat.length - 1].tanggal_lelang!).getFullYear()
      : null;

    return (
      <div className="space-y-4">
        {/* Section header — fully visible */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/25 to-red-600/15 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/15">
              <Icon icon="solar:diagram-down-bold-duotone" className="text-orange-400 text-xl" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-md shadow-orange-500/50 ring-2 ring-[#0f0f0f]">
              <Icon icon="solar:lock-keyhole-bold-duotone" className="text-white text-[9px]" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-tight">Riwayat Lelang Aset</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Riwayat tersembunyi — <span className="text-orange-400 font-bold">eksklusif member</span>
            </p>
          </div>
        </div>

        {/* Real data cards — blurred but visibly real */}
        <div className="relative overflow-hidden rounded-2xl" style={{ maxHeight: 220 }}>
          <div className="pointer-events-none select-none space-y-3 blur-[5px] brightness-[0.50] saturate-50">
            {riwayat.slice(0, 2).map((item, idx) => {
              const harga = item.nilai_limit_lelang ?? item.harga;
              const tanggal = formatDate(item.tanggal_lelang);
              const statusCfg = getStatus(item.status_tayang);
              return (
                <div key={item.id_property} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 pt-5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-black text-white shadow-lg shadow-orange-500/40">
                      {idx + 1}
                    </div>
                  </div>
                  <div
                    className="flex-1 rounded-2xl overflow-hidden border border-white/6 flex min-h-[110px]"
                    style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.03) 0%,rgba(15,23,42,0.90) 100%)" }}
                  >
                    <div className="relative w-36 sm:w-44 shrink-0 overflow-hidden">
                      {item.gambar_utama ? (
                        <Image src={item.gambar_utama} alt={item.judul} fill className="object-cover" sizes="176px" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800/60">
                          <Icon icon="solar:home-2-bold-duotone" className="text-4xl text-slate-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] text-slate-600 font-mono">#{item.id_property}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${statusCfg.bg} ${statusCfg.text} border ${statusCfg.border}`}>
                            <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-relaxed mb-3">{item.judul}</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-white mb-2">{formatRupiah(harga)}</p>
                        <div className="flex items-center gap-1.5">
                          <Icon icon="solar:calendar-date-bold-duotone" className="text-slate-600 text-xs flex-shrink-0" />
                          {tanggal ? (
                            <span className="text-[10px] text-slate-400">{tanggal}</span>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">Belum dijadwalkan</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gradient fade */}
          <div
            className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
            style={{ background: "linear-gradient(to top, #0f0f0f 0%, rgba(15,15,15,0.92) 50%, transparent 100%)" }}
          />

          {/* Hidden data badge */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap"
            style={{
              background: "rgba(15,10,5,0.85)",
              border: "1px solid rgba(249,115,22,0.40)",
              boxShadow: "0 0 20px rgba(249,115,22,0.20)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Icon icon="solar:eye-closed-bold-duotone" className="text-orange-400 text-base flex-shrink-0" />
            <span className="text-xs font-bold text-orange-300">Data historis tersembunyi</span>
          </div>
        </div>

        {/* Stats chips — mystery hints, no exact counts */}
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <Icon icon="solar:chart-bold-duotone" className="text-orange-400 text-sm flex-shrink-0" />
            <span className="text-[11px] font-bold text-slate-300">Riwayat Lelang Ada</span>
          </div>
          {oldestYear && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <Icon icon="solar:calendar-bold-duotone" className="text-blue-400 text-sm flex-shrink-0" />
              <span className="text-[11px] font-bold text-slate-300">Sejak {oldestYear}</span>
            </div>
          )}
          {terjualCount > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <Icon icon="solar:tag-price-bold-duotone" className="text-emerald-400 text-sm flex-shrink-0" />
              <span className="text-[11px] font-bold text-slate-300">Pernah Terjual</span>
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/[0.08] border border-orange-500/[0.20]">
            <Icon icon="solar:lock-keyhole-bold-duotone" className="text-orange-400 text-sm flex-shrink-0" />
            <span className="text-[11px] font-bold text-orange-300">Eksklusif Member</span>
          </div>
        </div>

        {/* Premium paywall card */}
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{
            background: "linear-gradient(160deg, rgba(20,10,4,0.98) 0%, rgba(15,8,4,0.98) 50%, rgba(10,10,15,0.98) 100%)",
            border: "1px solid rgba(249,115,22,0.24)",
            boxShadow: "0 0 60px rgba(249,115,22,0.08), 0 0 120px rgba(220,38,38,0.04), inset 0 1px 0 rgba(249,115,22,0.14)",
          }}
        >
          {/* Top edge glow */}
          <div className="absolute inset-x-[15%] top-0 h-px bg-gradient-to-r from-transparent via-orange-500/55 to-transparent" />

          {/* Background ambient orbs */}
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(249,115,22,0.10), transparent 70%)", filter: "blur(24px)" }}
          />
          <div
            className="absolute -right-10 top-10 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(220,38,38,0.12), transparent 70%)", filter: "blur(20px)" }}
          />

          <div className="relative p-6 sm:p-7">
            {/* Lock icon — glow orb */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-2xl scale-150"
                  style={{ background: "radial-gradient(ellipse, rgba(249,115,22,0.30), transparent 65%)", filter: "blur(14px)" }}
                />
                <div
                  className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(249,115,22,0.22) 0%, rgba(220,38,38,0.16) 100%)",
                    border: "1px solid rgba(249,115,22,0.40)",
                    boxShadow: "0 0 28px rgba(249,115,22,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >
                  <Icon icon="solar:lock-keyhole-bold-duotone" className="text-3xl text-orange-300" />
                </div>
              </div>
            </div>

            {/* Headline + subtext */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-black text-white tracking-tight leading-snug mb-2">
                Buka Akses Data Riwayat Lelang
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                Daftar gratis dan intai semua historis harga, pola lelang, dan analisa mendalam sebelum orang lain.
              </p>
            </div>

            {/* Benefit list */}
            <div className="space-y-2.5 mb-7">
              {[
                {
                  icon: "solar:chart-2-bold-duotone",
                  text: `Akses ${riwayat.length} riwayat lelang lengkap dengan detail harga tiap periode`,
                  color: "text-orange-400",
                  glow: "rgba(249,115,22,0.12)",
                },
                {
                  icon: "solar:graph-up-bold-duotone",
                  text: "Analisa tren pergerakan harga dan deteksi waktu terbaik untuk menawar",
                  color: "text-amber-400",
                  glow: "rgba(251,191,36,0.10)",
                },
                {
                  icon: "solar:target-bold-duotone",
                  text: "Bandingkan posisi harga saat ini vs historis untuk keputusan investasi lebih tajam",
                  color: "text-red-400",
                  glow: "rgba(239,68,68,0.10)",
                },
              ].map((b) => (
                <div
                  key={b.text}
                  className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${b.glow} 0%, rgba(255,255,255,0.02) 100%)`,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: `linear-gradient(135deg, ${b.glow} 0%, rgba(255,255,255,0.02) 100%)`,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Icon icon={b.icon} className={`text-base ${b.color}`} />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{b.text}</p>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              {/* Primary — signup */}
              <button
                type="button"
                onClick={() => setIsSignUpOpen(true)}
                className="group/cta relative flex items-center gap-4 w-full py-4 px-5 rounded-2xl overflow-hidden transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(160deg, #fb923c 0%, #f97316 25%, #ea580c 65%, #dc2626 100%)",
                  boxShadow: "0 0 40px rgba(249,115,22,0.38), 0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 0 rgba(0,0,0,0.22)",
                }}
              >
                {/* Glass top sheen */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[55%] rounded-t-2xl bg-gradient-to-b from-white/[0.18] to-transparent" />
                {/* Shimmer on hover */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover/cta:translate-x-full transition-transform duration-500" />

                {/* Icon orb */}
                <div className="relative flex-shrink-0 w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center border border-white/15 shadow-inner">
                  <Icon icon="solar:user-plus-bold-duotone" className="text-base text-white" />
                </div>

                {/* Label */}
                <div className="relative flex-1 min-w-0">
                  <p className="text-sm font-black text-white leading-tight">Daftar Gratis</p>
                  <p className="text-[10px] text-white/65 leading-tight mt-0.5">Mulai sekarang dan buka akses datanya</p>
                </div>

                {/* Arrow pill */}
                <div className="relative flex-shrink-0 w-8 h-8 rounded-xl bg-black/25 flex items-center justify-center border border-white/10 group-hover/cta:bg-black/35 transition-colors duration-200">
                  <Icon icon="solar:alt-arrow-right-bold" className="text-sm text-white/80" />
                </div>
              </button>

              {/* Secondary — signin */}
              <button
                type="button"
                onClick={() => setIsSignInOpen(true)}
                className="group/signin flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06]"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(148,163,184,1)",
                }}
              >
                <Icon icon="solar:login-bold-duotone" className="text-sm text-slate-500 group-hover/signin:text-slate-300 transition-colors" />
                <span>
                  Sudah punya akun?{" "}
                  <span className="text-orange-400 font-bold group-hover/signin:text-orange-300 transition-colors">
                    Masuk di sini
                  </span>
                </span>
              </button>
            </div>

            {/* Trust line */}
            <p className="text-center text-[10px] text-slate-600 mt-5 leading-relaxed">
              Gratis selamanya · Tidak butuh kartu kredit · Data properti terlengkap
            </p>
          </div>
        </div>

        {/* Sign In Modal */}
        {isSignInOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsSignInOpen(false)}
            />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
              <button
                onClick={() => setIsSignInOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <Icon icon="solar:close-circle-bold" className="text-2xl" />
              </button>
              <h3 className="text-2xl font-bold text-white mb-6 text-center">Selamat Datang Kembali</h3>
              <Signin
                closeModal={() => setIsSignInOpen(false)}
                openSignupModal={() => { setIsSignInOpen(false); setIsSignUpOpen(true); }}
              />
            </div>
          </div>
        )}

        {/* Sign Up Modal */}
        {isSignUpOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsSignUpOpen(false)}
            />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#181818] border border-white/10 rounded-2xl p-8 shadow-2xl">
              <button
                onClick={() => setIsSignUpOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <Icon icon="solar:close-circle-bold" className="text-2xl" />
              </button>
              <h3 className="text-2xl font-bold text-white mb-6 text-center">Buat Akun Baru</h3>
              <SignUp
                closeModal={() => setIsSignUpOpen(false)}
                openSigninModal={() => { setIsSignUpOpen(false); setIsSignInOpen(true); }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── LOGGED IN: full content ──────────────────────────── */
  return (
    <div className="relative group/section">
      {/* Ambient glow */}
      <div className="absolute -inset-6 bg-orange-500/3 rounded-[3rem] blur-3xl pointer-events-none opacity-0 group-hover/section:opacity-100 transition-opacity duration-700" />

      <div className="relative space-y-5">
        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Icon block */}
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/25 to-red-600/15 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/15">
                <Icon icon="solar:diagram-down-bold-duotone" className="text-orange-400 text-xl" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md shadow-orange-500/50 ring-2 ring-[#0f0f0f]">
                {riwayat.length}
              </div>
            </div>

            <div>
              <h3 className="text-base font-black text-white tracking-tight">
                Riwayat Lelang Aset
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tercatat dilelang{" "}
                <span className="text-orange-400 font-bold">{riwayat.length}×</span> dengan aset identik
              </p>
            </div>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {legalitasLabel && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 backdrop-blur-sm">
                <Icon icon="solar:shield-check-bold-duotone" className="text-emerald-400 text-sm flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-300">{legalitasLabel}</span>
                {nomorLegalitas && (
                  <span className="text-[10px] text-emerald-400/50 font-mono">
                    {nomorLegalitas}
                  </span>
                )}
              </div>
            )}
            {lokasiLabel && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 backdrop-blur-sm">
                <Icon icon="solar:map-point-bold-duotone" className="text-slate-400 text-sm flex-shrink-0" />
                <span className="text-xs text-slate-300 truncate max-w-[150px]">{lokasiLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── TIMELINE ───────────────────────────────────────── */}
        <div className="relative">
          {/* Connecting line */}
          {riwayat.length > 1 && (
            <div
              className="absolute left-[22px] top-10 bottom-10 w-px pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(249,115,22,0.5), rgba(249,115,22,0.15), transparent)",
              }}
            />
          )}

          <div className="space-y-4">
            {riwayat.map((item, idx) => {
              const isCurrent = item.id_property === currentIdProperty;
              const statusCfg = getStatus(item.status_tayang);
              const tanggal = formatDate(item.tanggal_lelang);
              const harga = item.nilai_limit_lelang ?? item.harga;

              return (
                <Link
                  key={item.id_property}
                  href={`/Lelang/${item.slug}-${item.id_property}`}
                  className="block group/card"
                >
                  <div className="flex gap-4 items-start">
                    {/* Timeline node */}
                    <div className="flex-shrink-0 flex flex-col items-center pt-5">
                      <div
                        className={`relative w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-300 ${
                          isCurrent
                            ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/40"
                            : "bg-slate-800/80 text-slate-400 border border-slate-700/60 group-hover/card:border-orange-500/30 group-hover/card:text-orange-300"
                        }`}
                      >
                        {isCurrent && (
                          <div className="absolute inset-0 rounded-2xl bg-orange-500/30 animate-ping opacity-75" />
                        )}
                        <span className="relative">{idx + 1}</span>
                      </div>
                    </div>

                    {/* Card */}
                    <div
                      className={`relative flex-1 rounded-2xl overflow-hidden border transition-all duration-300 ${
                        isCurrent
                          ? "border-orange-500/35 shadow-xl shadow-orange-500/8"
                          : "border-white/6 group-hover/card:border-white/12 group-hover/card:shadow-lg group-hover/card:shadow-black/40"
                      }`}
                      style={{
                        background: isCurrent
                          ? "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(17,24,39,0.95) 50%, rgba(15,23,42,0.98) 100%)"
                          : "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(15,23,42,0.90) 100%)",
                      }}
                    >
                      {/* Top edge accent line for current */}
                      {isCurrent && (
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
                      )}

                      <div className="flex min-h-[130px]">
                        {/* Image */}
                        <div className="relative w-36 sm:w-44 shrink-0 overflow-hidden">
                          {item.gambar_utama ? (
                            <>
                              <Image
                                src={item.gambar_utama}
                                alt={item.judul}
                                fill
                                className="object-cover transition-transform duration-700 group-hover/card:scale-105"
                                sizes="(max-width: 640px) 144px, 176px"
                                unoptimized
                              />
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-900/70" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800/60">
                              <Icon icon="solar:home-2-bold-duotone" className="text-4xl text-slate-700" />
                            </div>
                          )}

                          {/* SAAT INI overlay on image */}
                          {isCurrent && (
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500 shadow-md shadow-orange-500/50 backdrop-blur-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span className="text-[9px] font-black text-white tracking-wide">SAAT INI</span>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                          <div>
                            {/* Top row: ID + Status */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] text-slate-600 font-mono tracking-wider">
                                #{item.id_property}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${statusCfg.bg} ${statusCfg.text} border ${statusCfg.border}`}
                              >
                                <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
                                {statusCfg.label}
                              </span>
                            </div>

                            {/* Title */}
                            <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-relaxed mb-3">
                              {item.judul}
                            </p>
                          </div>

                          <div>
                            {/* Price */}
                            <p
                              className={`text-sm font-black mb-2 ${
                                isCurrent ? "text-orange-300" : "text-white"
                              }`}
                            >
                              {formatRupiah(harga)}
                            </p>

                            {/* Date */}
                            <div className="flex items-center gap-1.5">
                              <Icon
                                icon="solar:calendar-date-bold-duotone"
                                className="text-slate-600 text-xs flex-shrink-0"
                              />
                              {tanggal ? (
                                <span className="text-[10px] text-slate-400">{tanggal}</span>
                              ) : (
                                <span className="text-[10px] text-slate-600 italic">Belum dijadwalkan</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hover arrow */}
                      <div className="absolute right-3 top-3 opacity-0 group-hover/card:opacity-100 transition-all duration-200 translate-x-1 group-hover/card:translate-x-0">
                        <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center">
                          <Icon icon="solar:arrow-right-up-linear" className="text-white text-xs" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
