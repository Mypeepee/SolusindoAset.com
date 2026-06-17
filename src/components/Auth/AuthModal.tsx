"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

type Variant = "signin" | "signup" | "forgot";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  variant: Variant;
  children: React.ReactNode;
}

const SHOWCASE: Record<
  Variant,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    features: { icon: string; text: string }[];
    mobileTitle: string;
    mobileSubtitle: string;
  }
> = {
  signin: {
    eyebrow: "Portal Properti & Aset Premium",
    title: "Selamat datang kembali.",
    subtitle:
      "Lanjutkan perjalanan investasi properti Anda bersama platform aset paling tepercaya di Indonesia.",
    features: [
      { icon: "solar:verified-check-bold-duotone", text: "Ribuan listing properti & aset terverifikasi" },
      { icon: "solar:shield-check-bold-duotone", text: "Transaksi aman, transparan & terlindungi" },
      { icon: "solar:users-group-rounded-bold-duotone", text: "Didampingi agent profesional bersertifikat" },
    ],
    mobileTitle: "Selamat datang kembali",
    mobileSubtitle: "Masuk ke akun Solusindo Aset Anda",
  },
  signup: {
    eyebrow: "Gratis · Cepat · Tanpa Ribet",
    title: "Mulai dari sini.",
    subtitle:
      "Buka akses ke ribuan peluang properti & aset premium. Buat akun Anda dalam hitungan detik.",
    features: [
      { icon: "solar:home-smile-bold-duotone", text: "Akses penuh ke listing eksklusif" },
      { icon: "solar:hand-money-bold-duotone", text: "Titip jual & kelola aset dengan mudah" },
      { icon: "solar:medal-ribbons-star-bold-duotone", text: "Peluang berkarier menjadi agent" },
    ],
    mobileTitle: "Buat akun baru",
    mobileSubtitle: "Bergabung dengan Solusindo Aset",
  },
  forgot: {
    eyebrow: "Pemulihan Akun Aman",
    title: "Amankan kembali akun Anda.",
    subtitle:
      "Kami bantu pulihkan akses akun Anda dengan aman, hanya dalam beberapa langkah singkat.",
    features: [
      { icon: "solar:lock-keyhole-bold-duotone", text: "Proses pemulihan terenkripsi" },
      { icon: "solar:letter-bold-duotone", text: "Verifikasi lewat kode OTP email" },
      { icon: "solar:shield-keyhole-bold-duotone", text: "Identitas & data Anda tetap aman" },
    ],
    mobileTitle: "Pemulihan akun",
    mobileSubtitle: "Pulihkan akses akun Solusindo Aset Anda",
  },
};

export default function AuthModal({ open, onClose, variant, children }: AuthModalProps) {
  const sc = SHOWCASE[variant];

  // Tutup dengan tombol Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="auth-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Ambient glow di belakang card */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative w-full max-w-md lg:max-w-[940px]"
          >
            {/* Gradient border ring */}
            <div className="rounded-[1.85rem] bg-gradient-to-br from-white/20 via-white/[0.06] to-transparent p-px shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
              <div className="relative flex max-h-[92vh] overflow-hidden rounded-[calc(1.85rem-1px)] bg-[#0a0b0c]">
                {/* ── Showcase panel (desktop) ── */}
                <aside className="relative hidden w-[42%] shrink-0 overflow-hidden bg-gradient-to-br from-[#06251c] via-[#04140f] to-[#000510] lg:flex lg:flex-col">
                  {/* decorative layers */}
                  <div
                    className="absolute inset-0 opacity-[0.06]"
                    style={{
                      backgroundImage:
                        "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                      backgroundSize: "34px 34px",
                    }}
                  />
                  <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
                  <div className="absolute -bottom-20 -right-12 h-72 w-72 rounded-full bg-secondary/25 blur-3xl" />
                  <div className="absolute right-8 top-1/3 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

                  <div className="relative z-10 flex h-full flex-col justify-between p-9">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0">
                        <Image
                          src="/images/logo/LogoSolusindoPremier.png"
                          alt="Solusindo Aset"
                          fill
                          priority
                          className="object-contain"
                        />
                      </div>
                      <div className="text-lg font-bold tracking-tight text-white">
                        Solusindo<span className="text-primary"> Aset</span>
                      </div>
                    </div>

                    {/* Headline */}
                    <div className="my-8">
                      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                        <Icon icon="solar:stars-minimalistic-bold" className="text-sm" />
                        {sc.eyebrow}
                      </span>
                      <h2 className="text-[2.1rem] font-bold leading-[1.1] tracking-tight text-white">
                        {sc.title}
                      </h2>
                      <p className="mt-3.5 max-w-xs text-[15px] leading-relaxed text-white/55">
                        {sc.subtitle}
                      </p>

                      <ul className="mt-7 space-y-3.5">
                        {sc.features.map((f) => (
                          <li key={f.text} className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                              <Icon icon={f.icon} className="text-lg" />
                            </span>
                            <span className="text-sm font-medium text-white/75">{f.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Trust footer */}
                    <div className="flex items-center gap-2.5 border-t border-white/10 pt-5">
                      <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-xl text-primary" />
                      <p className="text-xs leading-snug text-white/45">
                        Dipercaya ribuan investor & agent properti di seluruh Indonesia
                      </p>
                    </div>
                  </div>
                </aside>

                {/* ── Form panel ── */}
                <div className="relative flex-1 overflow-y-auto custom-scrollbar">
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    aria-label="Tutup"
                    className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>

                  <div className="px-6 py-9 sm:px-9 sm:py-10">
                    {/* Brand untuk mobile (saat panel showcase tersembunyi) */}
                    <div className="mb-7 flex flex-col items-center text-center lg:hidden">
                      <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent">
                        <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-xl" />
                        <div className="relative h-9 w-9">
                          <Image
                            src="/images/logo/LogoSolusindoPremier.png"
                            alt="Solusindo Aset"
                            fill
                            priority
                            className="object-contain"
                          />
                        </div>
                      </div>
                      <h2 className="text-[1.6rem] font-bold leading-tight tracking-tight text-white">
                        {sc.mobileTitle}
                      </h2>
                      <p className="mt-1.5 text-sm text-white/45">{sc.mobileSubtitle}</p>
                    </div>

                    {children}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
