"use client";

import React, { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop } from "../../about/company-profile/components/_shared";

const SPRING = { type: "spring" as const, stiffness: 110, damping: 22, mass: 0.6 };

/** Word-by-word reveal with mask */
const RevealWords: React.FC<{
  text: string;
  className?: string;
  delay?: number;
  gradient?: boolean;
}> = ({ text, className = "", delay = 0, gradient = false }) => {
  const words = text.split(" ");
  return (
    <span className={`inline-block ${className}`}>
      {words.map((w, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden align-top mr-[0.25em] last:mr-0"
        >
          <motion.span
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{
              type: "spring",
              stiffness: 110,
              damping: 18,
              delay: delay + i * 0.08,
            }}
            className={`inline-block ${
              gradient
                ? "bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent"
                : ""
            }`}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </span>
  );
};

const Hero: React.FC = () => {
  const ref = useRef<HTMLElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 600], [0, 80]);
  const bgOpacity = useTransform(scrollY, [0, 500], [1, 0.35]);
  const contentY = useTransform(scrollY, [0, 400], [0, -30]);

  // Cursor spotlight — direct DOM write avoids React re-renders + spring physics
  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!spotlightRef.current) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    spotlightRef.current.style.background =
      `radial-gradient(420px circle at ${x}% ${y}%, rgba(52,211,153,0.10), transparent 55%)`;
  };

  return (
    <section
      ref={ref}
      onMouseMove={onMouseMove}
      className="relative w-full overflow-hidden bg-[#05070D] pt-16 sm:pt-20 lg:pt-24 pb-10 sm:pb-12 lg:pb-16"
    >
      {/* Cursor spotlight — updated via direct DOM write on mousemove */}
      <div
        ref={spotlightRef}
        className="hidden md:block pointer-events-none absolute inset-0 z-[2] opacity-70"
      />

      {/* Parallax ambient */}
      <motion.div
        style={{ y: bgY, opacity: bgOpacity }}
        className="absolute inset-0"
      >
        <AmbientBackdrop variant="emerald" intensity="high" />
      </motion.div>

      {/* Concentric rings — CSS animation, no JS physics */}
      <div className="hidden lg:flex absolute inset-0 z-[1] items-center justify-center pointer-events-none animate-[fadeIn_1.4s_0.5s_both]">
        <div className="relative h-[40rem] w-[40rem]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0"
              style={{ transform: `scale(${1 - i * 0.18})` }}
            >
              <div
                className="absolute inset-0 rounded-full border border-emerald-400/[0.06] animate-spin"
                style={{
                  animationDuration: `${80 + i * 24}s`,
                  animationDirection: i % 2 !== 0 ? "reverse" : "normal",
                  animationTimingFunction: "linear",
                }}
              >
                <span
                  className="absolute h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]"
                  style={{ top: "-4px", left: "50%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vertical beam */}
      <div className="hidden lg:block pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-emerald-400/15 to-transparent" />

      <motion.div
        style={{ y: contentY }}
        className="container relative z-10 mx-auto px-4 sm:px-6 max-w-screen-xl"
      >
        <div className="mx-auto max-w-4xl flex flex-col items-center text-center">
          {/* Pill */}
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.05 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.22em] uppercase text-emerald-300">
              Layanan Titip Jual Resmi
            </span>
          </motion.div>

          {/* Title — word-by-word mask reveal */}
          <h1 className="mt-4 text-white font-extrabold text-[2.4rem] leading-[1.04] sm:text-5xl md:text-6xl lg:text-[5rem] tracking-tight">
            <RevealWords text="Titipkan Aset Anda." delay={0.18} />
            <br />
            <RevealWords text="Tenang Penjualannya." delay={0.48} gradient />
          </h1>

          {/* Tagline divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.6 }}
            className="mt-3 flex items-center gap-3 text-emerald-300/80"
          >
            <span className="h-px w-8 bg-emerald-400/50" />
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.4em] uppercase">
              Beyond Expectations
            </span>
            <span className="h-px w-8 bg-emerald-400/50" />
          </motion.div>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.95 }}
            className="mt-4 max-w-2xl text-white/70 text-[14.5px] sm:text-base md:text-lg leading-relaxed px-2"
          >
            Sistem titip jual paling{" "}
            <span className="text-white font-semibold">transparan</span> di
            Indonesia. Dilindungi{" "}
            <span className="text-emerald-300 font-semibold">
              perjanjian notaris
            </span>
            , dipasarkan oleh{" "}
            <span className="text-emerald-300 font-semibold">
              agent tersertifikasi AREBI
            </span>
            , dengan laporan progres setiap minggu.
          </motion.p>

          {/* Trust chips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 1.05 }}
            className="mt-5 sm:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-3xl"
          >
            {[
              {
                i: "solar:hand-money-bold-duotone",
                t: "Tanpa Biaya Muka",
                s: "Komisi hanya saat closing",
              },
              {
                i: "solar:document-text-bold-duotone",
                t: "Perjanjian Notaris",
                s: "Sertifikat aman di tempat",
              },
              {
                i: "solar:bell-bing-bold-duotone",
                t: "Update Mingguan",
                s: "Laporan progres real-time",
              },
            ].map((c, idx) => (
              <motion.div
                key={c.t}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: 1.15 + idx * 0.08 }}
                whileHover={{ y: -3 }}
                className="group flex items-start gap-2.5 rounded-2xl border border-emerald-400/[0.14] bg-gradient-to-b from-emerald-400/[0.05] to-white/[0.015] backdrop-blur-md p-3 sm:p-3.5 hover:border-emerald-400/30 hover:bg-emerald-400/[0.07] transition-colors text-left"
              >
                <Icon
                  icon={c.i}
                  className="text-emerald-300 text-xl shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300"
                />
                <div className="min-w-0">
                  <div className="text-[12px] sm:text-[13px] font-bold text-white">
                    {c.t}
                  </div>
                  <div className="text-[10.5px] sm:text-[11px] text-white/55 leading-snug">
                    {c.s}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 1.35 }}
            className="mt-6 sm:mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3.5 w-full sm:w-auto max-w-sm sm:max-w-none"
          >
            <a
              href="#form-titip-jual"
              className="group relative inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-[#05070D] font-bold text-sm tracking-wide shadow-[0_8px_30px_rgba(52,211,153,0.25)] hover:shadow-[0_14px_44px_rgba(52,211,153,0.5)] active:scale-[0.98] transition-all overflow-hidden"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                Mulai Titip Jual — Gratis
                <Icon
                  icon="solar:arrow-right-bold"
                  className="text-lg group-hover:translate-x-1 transition-transform"
                />
              </span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/30 to-white/0 group-hover:translate-x-full transition-transform duration-700 ease-out" />
            </a>
            <a
              href="#cara-kerja"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-full border border-emerald-400/25 bg-white/[0.04] backdrop-blur-md text-white text-sm font-semibold hover:bg-white/[0.08] hover:border-emerald-400/40 active:scale-[0.98] transition-all"
            >
              <Icon
                icon="solar:play-circle-bold-duotone"
                className="text-lg text-emerald-300"
              />
              Lihat Cara Kerjanya
            </a>
          </motion.div>

          {/* Compliance */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.6 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] sm:text-[10.5px] tracking-[0.22em] uppercase text-white/35 font-bold"
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon
                icon="solar:shield-check-bold"
                className="text-emerald-400/70"
              />
              AREBI DPD Jatim
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon
                icon="solar:verified-check-bold"
                className="text-emerald-400/70"
              />
              PMK 122/2023
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon
                icon="solar:scale-balanced-bold"
                className="text-emerald-400/70"
              />
              Notaris & PPAT Mitra
            </span>
          </motion.div>

          {/* Scroll cue */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.9, duration: 0.6 }}
            className="mt-7 sm:mt-8 flex flex-col items-center gap-2 text-white/30"
          >
            <span className="text-[9.5px] font-bold tracking-[0.3em] uppercase">
              Scroll
            </span>
            <motion.span
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="block h-5 w-px bg-gradient-to-b from-emerald-400/60 to-transparent"
            />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
