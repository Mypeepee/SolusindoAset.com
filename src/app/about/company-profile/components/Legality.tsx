"use client";

import React, { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

type Cert = {
  icon: string;
  title: string;
  no: string;
  detail: string;
  issued: string;
};

const certificates: Cert[] = [
  {
    icon: "solar:document-add-bold-duotone",
    title: "Akta Pendirian",
    no: "No. 17 / 25 April 2024",
    detail: "Notaris Heryanto Tjhang, S.H. — Surabaya.",
    issued: "25 Apr 2024",
  },
  {
    icon: "solar:notes-bold-duotone",
    title: "Pengesahan Menkumham RI",
    no: "AHU-0032697.AH.01.01.TAHUN 2024",
    detail: "Disahkan Kementerian Hukum & HAM Republik Indonesia.",
    issued: "08 Mei 2024",
  },
  {
    icon: "solar:case-minimalistic-bold-duotone",
    title: "Nomor Induk Berusaha",
    no: "NIB 1705240072751",
    detail: "Diterbitkan sistem OSS Republik Indonesia.",
    issued: "17 Mei 2024",
  },
  {
    icon: "solar:buildings-3-bold-duotone",
    title: "Klasifikasi Usaha (KBLI)",
    no: "Kode 68200",
    detail: "Real Estat Atas Dasar Balas Jasa (Fee) Atau Kontrak.",
    issued: "Berlaku Sekarang",
  },
];

const complianceTags = [
  { code: "PMK No. 122/2023", label: "Balai Lelang" },
  { code: "KMK No. 36/KMK.04/2002", label: "Pra Lelang" },
  { code: "OSS Republik Indonesia", label: "Berusaha" },
  { code: "BPN Compatible", label: "Pertanahan" },
];

/* ────────── Single Certificate Card (3D tilt + spotlight + conic border) ────────── */
const CertCard: React.FC<{ c: Cert; index: number }> = ({ c, index }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const rxSpring = useSpring(useTransform(my, [-150, 150], [5, -5]), {
    stiffness: 140,
    damping: 18,
  });
  const rySpring = useSpring(useTransform(mx, [-150, 150], [-5, 5]), {
    stiffness: 140,
    damping: 18,
  });

  const sx = useMotionValue(-9999);
  const sy = useMotionValue(-9999);
  const spotlight = useTransform(
    [sx, sy] as unknown as MotionValue<number>[],
    ([x, y]: number[]) =>
      `radial-gradient(360px circle at ${x}px ${y}px, rgba(52,211,153,0.16), transparent 60%)`
  );

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    const localX = e.clientX - r.left;
    const localY = e.clientY - r.top;
    mx.set(localX - r.width / 2);
    my.set(localY - r.height / 2);
    sx.set(localX);
    sy.set(localY);
  };
  const handleLeave = () => {
    mx.set(0);
    my.set(0);
    sx.set(-9999);
    sy.set(-9999);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        delay: index * 0.1,
        duration: 0.7,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      style={{
        transformStyle: "preserve-3d",
        perspective: 1000,
        rotateX: rxSpring,
        rotateY: rySpring,
      }}
      className="group/cert relative rounded-2xl [transform-style:preserve-3d]"
    >
      {/* Animated conic gradient border */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-50 group-hover/cert:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "conic-gradient(from var(--leg-angle, 0deg), rgba(52,211,153,0.55), rgba(20,184,166,0.05) 35%, rgba(52,211,153,0.55) 70%, rgba(20,184,166,0.05))",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
          animation: "leg-spin 10s linear infinite",
          animationDelay: `${index * -1.2}s`,
        }}
      />

      {/* Card body */}
      <div className="relative rounded-2xl bg-[#0B0F17]/95 backdrop-blur-xl p-6 sm:p-7 overflow-hidden h-full flex flex-col">
        {/* Spotlight */}
        <motion.div
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{ background: spotlight }}
        />

        {/* Corner ticks */}
        <span className="pointer-events-none absolute top-2.5 left-2.5 h-2.5 w-2.5 border-l border-t border-emerald-400/40 opacity-60 group-hover/cert:opacity-100 transition-opacity" />
        <span className="pointer-events-none absolute top-2.5 right-2.5 h-2.5 w-2.5 border-r border-t border-emerald-400/40 opacity-60 group-hover/cert:opacity-100 transition-opacity" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-2.5 w-2.5 border-l border-b border-emerald-400/40 opacity-60 group-hover/cert:opacity-100 transition-opacity" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-2.5 w-2.5 border-r border-b border-emerald-400/40 opacity-60 group-hover/cert:opacity-100 transition-opacity" />

        {/* Soft accent glow */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-3xl bg-emerald-400/10 group-hover/cert:bg-emerald-400/25 transition-colors duration-700" />

        {/* Top row: cert index + verified */}
        <div className="relative flex items-center justify-between">
          <span
            className="text-[10px] tracking-[0.3em] uppercase font-mono font-bold text-emerald-300/80"
            style={{ transform: "translateZ(20px)" }}
          >
            SERTIFIKAT / {String(index + 1).padStart(2, "0")}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/[0.06] text-[9px] tracking-[0.22em] uppercase font-bold font-mono text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Verified
          </span>
        </div>

        {/* Icon badge */}
        <div
          className="relative mt-5 h-14 w-14 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] flex items-center justify-center transition-all duration-500 group-hover/cert:scale-105 group-hover/cert:border-emerald-400/55 group-hover/cert:bg-emerald-400/[0.12] group-hover/cert:shadow-[0_0_28px_rgba(52,211,153,0.3)]"
          style={{ transform: "translateZ(30px)" }}
        >
          <Icon icon={c.icon} className="text-2xl text-emerald-300" />
          {/* Mini scanner sweep */}
          <motion.div
            className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
            initial={false}
          >
            <motion.div
              className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
              animate={{ top: ["-10%", "110%"] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 1.5 + index * 0.4,
              }}
            />
          </motion.div>
        </div>

        {/* Title */}
        <h3
          className="relative mt-5 text-white font-extrabold text-[17px] sm:text-lg leading-snug tracking-tight"
          style={{ transform: "translateZ(20px)" }}
        >
          {c.title}
        </h3>

        {/* Cert number — mono code */}
        <div
          className="relative mt-2 text-emerald-300 font-mono font-bold text-[13px] sm:text-sm tracking-tight break-all"
          style={{ transform: "translateZ(15px)" }}
        >
          {c.no}
        </div>

        {/* Animated underline */}
        <div className="relative mt-3 h-px w-full overflow-hidden bg-white/[0.06]">
          <motion.div
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
            animate={{ x: ["-100%", "300%"] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 1.8 + (index % 4) * 0.3,
            }}
          />
        </div>

        {/* Detail */}
        <p
          className="relative mt-3 text-white/55 text-[13px] leading-relaxed flex-1"
          style={{ transform: "translateZ(10px)" }}
        >
          {c.detail}
        </p>

        {/* Bottom meta strip — issued */}
        <div className="relative mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3 text-[10px] font-mono">
          <span className="inline-flex items-center gap-1.5 tracking-[0.15em] uppercase font-bold text-white/40">
            <Icon
              icon="solar:calendar-mark-bold"
              className="text-emerald-400/70"
            />
            {c.issued}
          </span>
          <span className="inline-flex items-center gap-1 tracking-[0.18em] uppercase font-bold text-emerald-300/70">
            <Icon
              icon="solar:shield-check-bold"
              className="text-emerald-400/80"
            />
            On Record
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const Legality: React.FC = () => {
  return (
    <section className="relative w-full pt-6 sm:pt-8 md:pt-10 pb-6 sm:pb-8 md:pb-10 overflow-hidden bg-[#070A12]">
      <AmbientBackdrop variant="emerald" />

      {/* Inline keyframes for conic spin */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes leg-spin { to { --leg-angle: 360deg; } }
        @property --leg-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
      `,
        }}
      />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Legalitas & Kepatuhan</PillLabel>
          <SectionTitle
            title={
              <>
                Fondasi{" "}
                <span className="bg-gradient-to-r from-[#86efac] via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Kepastian Hukum
                </span>{" "}
                Bagi Setiap Klien.
              </>
            }
            subtitle="Dokumen legal lengkap, terdaftar, dan terverifikasi — fondasi keamanan setiap transaksi yang kami tangani."
          />
        </div>

        {/* Ledger badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-6 flex items-center justify-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.04] backdrop-blur-md text-[10px] tracking-[0.28em] uppercase font-mono font-bold text-emerald-300/80">
            <Icon icon="solar:database-bold" className="text-sm text-emerald-300" />
            On-Record Registry
            <span className="h-1 w-1 rounded-full bg-emerald-400/60" />
            04 Documents
          </div>
        </motion.div>

        {/* Certificate grid */}
        <div className="mt-8 sm:mt-10 grid sm:grid-cols-2 gap-4 sm:gap-5 max-w-4xl mx-auto">
          {certificates.map((c, i) => (
            <CertCard key={c.title} c={c} index={i} />
          ))}
        </div>

        {/* Compliance Ribbon — premium */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="relative mt-8 sm:mt-10 max-w-4xl mx-auto"
        >
          {/* Outer glow */}
          <div
            className="pointer-events-none absolute -inset-6 rounded-[2.5rem] blur-3xl opacity-50"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(52,211,153,0.18), transparent 65%)",
            }}
          />

          <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-emerald-400/40 via-white/[0.06] to-teal-400/20 overflow-hidden">
            <div className="relative rounded-2xl bg-[#0B0F17]/95 backdrop-blur-xl p-6 sm:p-7 overflow-hidden">
              {/* HUD ticks */}
              <span className="pointer-events-none absolute top-3 left-3 h-3 w-3 border-l border-t border-emerald-400/50" />
              <span className="pointer-events-none absolute top-3 right-3 h-3 w-3 border-r border-t border-emerald-400/50" />
              <span className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-l border-b border-emerald-400/50" />
              <span className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-r border-b border-emerald-400/50" />

              {/* Scan line */}
              <motion.div
                className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
                animate={{ top: ["-2%", "102%"] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Header row */}
              <div className="relative flex items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] tracking-[0.28em] uppercase font-bold font-mono text-emerald-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Compliance · Live
                </span>
                <span className="text-[9px] sm:text-[10px] tracking-[0.22em] uppercase font-mono text-white/40">
                  Last Sync · 03 Jun 2026
                </span>
              </div>

              {/* Main content */}
              <div className="relative mt-5 flex flex-col sm:flex-row items-start gap-5">
                <div
                  className="shrink-0 relative h-16 w-16 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] flex items-center justify-center shadow-[0_0_28px_rgba(52,211,153,0.18)]"
                >
                  <Icon
                    icon="solar:shield-check-bold-duotone"
                    className="text-3xl text-emerald-300"
                  />
                  {/* Orbit ring */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl border border-emerald-400/20"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    style={{
                      borderStyle: "dashed",
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-extrabold text-base sm:text-lg tracking-tight">
                    Tercatat Resmi & Tunduk Regulasi
                  </h4>
                  <p className="mt-1.5 text-white/60 text-[13px] sm:text-sm leading-relaxed">
                    Beroperasi berdasarkan{" "}
                    <span className="text-emerald-300 font-semibold">
                      PMK No. 122 Tahun 2023
                    </span>{" "}
                    sebagai Perseroan Terbatas khusus Balai Lelang, dan
                    berpedoman pada{" "}
                    <span className="text-emerald-300 font-semibold">
                      KMK No. 36/KMK.04/2002
                    </span>{" "}
                    untuk batasan hukum Pra Lelang.
                  </p>
                </div>
              </div>

              {/* Compliance chip strip */}
              <div className="relative mt-5 pt-5 border-t border-white/[0.06] flex flex-wrap gap-2">
                {complianceTags.map((t, i) => (
                  <motion.span
                    key={t.code}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.04] text-[10px] sm:text-[11px] font-mono font-bold text-emerald-300/80"
                  >
                    <Icon
                      icon="solar:verified-check-bold"
                      className="text-xs text-emerald-300"
                    />
                    {t.code}
                    <span className="text-white/30 normal-case font-sans font-normal ml-0.5">
                      / {t.label}
                    </span>
                  </motion.span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Legality;
