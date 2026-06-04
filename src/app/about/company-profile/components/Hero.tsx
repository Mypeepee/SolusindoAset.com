"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop } from "./_shared";

type Stats = {
  activeListings: number;
  transactionVolume: number;
  professionalAgents: number;
  clientSatisfaction: number;
};

const formatCompactID = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}rb`;
  return n.toLocaleString("id-ID");
};

const formatIDR = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "Rp 0";
  return `Rp ${formatCompactID(n)}`;
};

const Hero: React.FC = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 120]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0.3]);

  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/about/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setStats(d as Stats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const trustStats = [
    {
      icon: "solar:buildings-3-bold-duotone",
      label: "Listing Aktif",
      value: stats ? formatCompactID(stats.activeListings) : null,
      suffix: stats && stats.activeListings > 0 ? "+" : "",
    },
    {
      icon: "solar:wallet-money-bold-duotone",
      label: "Total Omzet",
      value: stats ? formatIDR(stats.transactionVolume) : null,
      suffix: "",
    },
    {
      icon: "solar:users-group-rounded-bold-duotone",
      label: "Agent Profesional",
      value: stats ? formatCompactID(stats.professionalAgents) : null,
      suffix: stats && stats.professionalAgents > 0 ? "+" : "",
    },
    {
      icon: "solar:medal-ribbons-star-bold-duotone",
      label: "Kepuasan Klien",
      value: stats ? `${stats.clientSatisfaction.toFixed(1)}%` : null,
      suffix: "",
    },
  ];

  return (
    <section className="relative w-full overflow-hidden bg-[#05070D] pt-20 sm:pt-24 lg:pt-28 pb-4 sm:pb-6">
      {/* Background image — subtle, dimmed */}
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        <Image
          src="/images/hero/banner.jpg"
          alt="Solusindo Premier"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-20 md:opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070D]/85 via-[#05070D]/90 to-[#05070D]" />
      </motion.div>

      {/* Ambient emerald glow */}
      <AmbientBackdrop variant="emerald" intensity="high" />

      {/* Floating concentric rings (emerald) — desktop only */}
      <motion.div
        className="hidden md:flex absolute inset-0 z-[1] items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 1.4 }}
      >
        <div className="relative h-[36rem] w-[36rem] lg:h-[44rem] lg:w-[44rem]">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-emerald-400/[0.07]"
              style={{ transform: `scale(${1 - i * 0.18})` }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{
                duration: 70 + i * 20,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <span
                className="absolute h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]"
                style={{ top: "-4px", left: "50%" }}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="container relative z-10 mx-auto px-4 sm:px-6 max-w-screen-xl">
        <div className="flex flex-col items-center text-center">
          {/* Pill */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.22em] uppercase text-emerald-300">
              Mitra Resmi Lelang & Solusi Aset
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.8 }}
            className="mt-5 sm:mt-7 text-white font-extrabold text-[2.4rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-[5.25rem] tracking-tight max-w-4xl"
          >
            Lebih dari Sekadar{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Janji.
            </span>
          </motion.h1>

          {/* Brand tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="mt-4 flex items-center gap-3 text-emerald-300/80"
          >
            <span className="h-px w-8 bg-emerald-400/50" />
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.4em] uppercase">
              Beyond Expectations
            </span>
            <span className="h-px w-8 bg-emerald-400/50" />
          </motion.div>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.8 }}
            className="mt-6 sm:mt-7 max-w-2xl text-white/70 text-[15px] sm:text-base md:text-lg leading-relaxed px-2"
          >
            <span className="text-white font-semibold">PT Solusi Tangguh Rejeki</span>{" "}
            — perusahaan resmi yang membantu Anda{" "}
            <span className="text-emerald-300 font-semibold">
              jual, beli, sewa, KPR
            </span>
            ,{" "}
            <span className="text-emerald-300 font-semibold">lelang</span>, dan menangani
            aset bermasalah dalam{" "}
            <span className="text-white font-semibold">satu pintu layanan hukum lengkap</span>.
          </motion.p>

          {/* Service chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.8 }}
            className="mt-6 sm:mt-7 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 max-w-xl"
          >
            {[
              { l: "Titip Jual", i: "solar:hand-shake-bold" },
              { l: "Beli", i: "solar:bag-check-bold" },
              { l: "Sewa", i: "solar:key-minimalistic-bold" },
              { l: "KPR", i: "solar:calculator-minimalistic-bold" },
              { l: "Lelang", i: "solar:tag-price-bold" },
              { l: "Kepailitan", i: "solar:scale-balanced-bold" },
            ].map((t) => (
              <span
                key={t.l}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold text-white/85 border border-emerald-400/15 bg-emerald-400/[0.04] backdrop-blur-sm"
              >
                <Icon icon={t.i} className="text-sm text-emerald-300" />
                {t.l}
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto max-w-sm sm:max-w-none"
          >
            <a
              href="#executive-summary"
              className="group inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-[#05070D] font-bold text-sm tracking-wide shadow-[0_8px_30px_rgba(52,211,153,0.25)] hover:shadow-[0_12px_40px_rgba(52,211,153,0.45)] active:scale-[0.98] transition-all"
            >
              Telusuri Profil
              <Icon
                icon="solar:arrow-right-bold"
                className="text-lg group-hover:translate-x-1 transition-transform"
              />
            </a>
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-full border border-emerald-400/25 bg-white/[0.04] backdrop-blur-md text-white text-sm font-semibold hover:bg-white/[0.08] hover:border-emerald-400/40 active:scale-[0.98] transition-all"
            >
              <Icon
                icon="solar:phone-calling-bold-duotone"
                className="text-lg text-emerald-300"
              />
              Hubungi Tim Kami
            </a>
          </motion.div>

          {/* Trust strip — live stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 1 }}
            className="mt-12 sm:mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-3xl"
          >
            {trustStats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95 + i * 0.08, duration: 0.5 }}
                className="relative rounded-2xl border border-emerald-400/[0.12] bg-gradient-to-b from-emerald-400/[0.04] to-white/[0.015] backdrop-blur-md p-4 sm:p-5 text-left overflow-hidden group hover:border-emerald-400/30 transition-colors"
              >
                <div className="absolute top-0 right-0 h-20 w-20 rounded-full bg-emerald-400/[0.06] blur-2xl group-hover:bg-emerald-400/15 transition-all duration-700" />
                <div className="relative">
                  <Icon
                    icon={s.icon}
                    className="text-lg sm:text-xl text-emerald-300"
                  />
                  <div className="mt-2 text-lg sm:text-2xl font-extrabold text-white tracking-tight tabular-nums">
                    {s.value !== null ? (
                      <>
                        {s.value}
                        {s.suffix}
                      </>
                    ) : (
                      <span className="inline-block h-6 sm:h-7 w-16 sm:w-20 rounded-md bg-white/5 animate-pulse" />
                    )}
                  </div>
                  <div className="text-[9px] sm:text-[10px] tracking-[0.18em] uppercase text-white/55 mt-1 font-semibold">
                    {s.label}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Compliance line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="mt-8 sm:mt-10 text-[9px] sm:text-[10px] tracking-[0.35em] uppercase text-white/30 flex items-center gap-2"
          >
            <Icon icon="solar:shield-check-bold" className="text-emerald-400/70" />
            AREBI DPD Jawa Timur · Terdaftar PMK No. 122/2023
          </motion.p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
