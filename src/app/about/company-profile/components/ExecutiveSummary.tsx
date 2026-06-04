"use client";

import React, { useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useScroll,
  type MotionValue,
} from "framer-motion";
import { Icon } from "@iconify/react";

/* ============================================================
   EXECUTIVE SUMMARY — Solusindo Aset (Web3 Premium Edition)
   Inti: dua janji untuk klien — Transaksi Aman & Perjanjian
   Berkekuatan Hukum. Sisi visual digarap layer-by-layer:
   - mouse-tracking aurora spotlight
   - animated mesh-grid + scanline
   - word-by-word headline reveal
   - infinite marquee untuk fear strip
   - 3D tilt promise cards w/ animated gradient border
   ============================================================ */

const fears = [
  "Sertifikat ganda atau bermasalah",
  "Properti masih dijaminkan ke bank",
  "Dalam sengketa keluarga / waris",
  "Listing palsu, foto tidak sesuai",
  "Penjual hilang setelah DP ditransfer",
  "Perjanjian lemah, tidak diakui hukum",
  "Pajak & balik nama tidak beres",
  "Tidak ada pendampingan setelah closing",
];

const promises = [
  {
    num: "01",
    icon: "solar:shield-check-bold-duotone",
    title: "Keabsahan Legalitas",
    desc: "Setiap properti yang kami pasarkan dipastikan sah secara hukum — bukan sertifikat ganda, bukan sita, dan tidak dalam sengketa.",
  },
  {
    num: "02",
    icon: "solar:document-text-bold-duotone",
    title: "Dokumen Lengkap",
    desc: "Sertifikat, IMB, PBB, dan riwayat kepemilikan kami siapkan dan periksa sebelum transaksi berjalan.",
  },
  {
    num: "03",
    icon: "solar:users-group-rounded-bold-duotone",
    title: "Dampingan Hingga Serah Terima",
    desc: "Tim kami mendampingi proses dari awal sampai kunci dan dokumen berada di tangan Anda.",
  },
  {
    num: "04",
    icon: "solar:verified-check-bold-duotone",
    title: "Jaminan 100% Serah Terima",
    desc: "Kami berkomitmen pada hasil akhir: serah terima yang utuh, tanpa kewajiban tersisa di belakang.",
  },
];

/* ────────── Animated mesh-grid background (web3 staple) ────────── */
const MeshGrid: React.FC = () => (
  <>
    <div
      className="absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        maskImage:
          "radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)",
      }}
    />
    {/* slow aurora orbs */}
    <motion.div
      className="absolute top-1/4 -left-32 h-[28rem] w-[28rem] rounded-full blur-[140px] bg-emerald-500/[0.08]"
      animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute bottom-0 -right-20 h-[32rem] w-[32rem] rounded-full blur-[160px] bg-teal-500/[0.08]"
      animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
    />
  </>
);

/* ────────── Mouse-tracking spotlight ────────── */
const MouseSpotlight: React.FC<{
  containerRef: React.RefObject<HTMLElement>;
}> = ({ containerRef }) => {
  const mx = useMotionValue(-9999);
  const my = useMotionValue(-9999);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mx.set(e.clientX - r.left);
      my.set(e.clientY - r.top);
    };
    const onLeave = () => {
      mx.set(-9999);
      my.set(-9999);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [containerRef, mx, my]);

  const background = useTransform(
    [mx, my] as unknown as MotionValue<number>[],
    ([x, y]: number[]) =>
      `radial-gradient(600px circle at ${x}px ${y}px, rgba(52, 211, 153, 0.08), transparent 65%)`
  );

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[1] hidden md:block"
      style={{ background }}
    />
  );
};

/* ────────── Word-by-word reveal ────────── */
const WordReveal: React.FC<{
  text: string;
  className?: string;
  delayBase?: number;
}> = ({ text, className = "", delayBase = 0 }) => {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{
            delay: delayBase + i * 0.045,
            duration: 0.6,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="inline-block"
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
};

/* ────────── Fear pill (single row in reel) ────────── */
const FearPill: React.FC<{ label: string }> = ({ label }) => (
  <div className="inline-flex items-center gap-2 sm:gap-2.5 pl-2 pr-3.5 sm:pl-2.5 sm:pr-4 py-1.5 sm:py-2 rounded-full border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-md whitespace-nowrap">
    <span className="shrink-0 inline-flex h-5 w-5 sm:h-[22px] sm:w-[22px] items-center justify-center rounded-full border border-red-400/25 bg-red-500/[0.08]">
      <Icon
        icon="solar:close-circle-bold"
        className="text-[12px] sm:text-[13px] text-red-300/85"
      />
    </span>
    <span className="text-[11.5px] sm:text-[13px] font-medium text-white/70">
      <span className="line-through decoration-red-400/35 decoration-[1px] underline-offset-2">
        {label}
      </span>
    </span>
  </div>
);

/* ────────── Vertical infinite reel ────────── */
const FearReel: React.FC = () => {
  const ROW_H = 44; // height per row (px)
  const VISIBLE_ROWS = 3;
  const VIEWPORT_H = ROW_H * VISIBLE_ROWS;
  const doubled = [...fears, ...fears];
  const totalH = ROW_H * fears.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative mx-auto w-full max-w-md sm:max-w-lg"
    >
      {/* Outer HUD frame */}
      <div className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.025] via-white/[0.01] to-white/[0.005] backdrop-blur-md overflow-hidden">
        {/* Corner ticks */}
        <span className="pointer-events-none absolute top-2 left-2 h-2.5 w-2.5 border-l border-t border-red-400/40 z-20" />
        <span className="pointer-events-none absolute top-2 right-2 h-2.5 w-2.5 border-r border-t border-red-400/40 z-20" />
        <span className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-l border-b border-red-400/40 z-20" />
        <span className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-r border-b border-red-400/40 z-20" />

        {/* Scan line sweeping vertically */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent z-[6]"
          animate={{ top: ["-2%", "102%"] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Reel viewport */}
        <div
          className="relative overflow-hidden px-3 sm:px-4 py-2"
          style={{
            height: VIEWPORT_H + 16,
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
          }}
        >
          {/* Center focus band */}
          <div
            className="pointer-events-none absolute inset-x-3 sm:inset-x-4 z-[4]"
            style={{
              top: `${8 + ROW_H}px`,
              height: `${ROW_H}px`,
              background:
                "linear-gradient(90deg, transparent, rgba(248,113,113,0.07), transparent)",
              borderTop: "1px solid rgba(248,113,113,0.18)",
              borderBottom: "1px solid rgba(248,113,113,0.18)",
            }}
          >
            {/* Bracket markers on focus band */}
            <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-3 w-[2px] bg-red-400/60 rounded-full shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
            <span className="absolute -right-1 top-1/2 -translate-y-1/2 h-3 w-[2px] bg-red-400/60 rounded-full shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
          </div>

          {/* Infinite scrolling stack */}
          <motion.div
            animate={{ y: [0, -totalH] }}
            transition={{
              duration: fears.length * 2.4,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex flex-col will-change-transform"
          >
            {doubled.map((f, i) => (
              <div
                key={`${f}-${i}`}
                className="flex items-center justify-center"
                style={{ height: ROW_H }}
              >
                <FearPill label={f} />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Bottom meta strip */}
        <div className="relative flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-black/20">
          <span className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-bold text-red-300/70">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-red-400" />
            </span>
            Risk Feed · Live
          </span>
          <span className="text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-mono text-white/30">
            {String(fears.length).padStart(2, "0")} Items
          </span>
        </div>
      </div>
    </motion.div>
  );
};

/* ────────── Compact Promise Card (4-up grid) ────────── */
const PromiseCard: React.FC<{
  num: string;
  icon: string;
  title: string;
  desc: string;
  index: number;
}> = ({ num, icon, title, desc, index }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const rxSpring = useSpring(useTransform(my, [-100, 100], [4, -4]), {
    stiffness: 140,
    damping: 18,
  });
  const rySpring = useSpring(useTransform(mx, [-100, 100], [-4, 4]), {
    stiffness: 140,
    damping: 18,
  });

  const sx = useMotionValue(-9999);
  const sy = useMotionValue(-9999);
  const cardSpotlight = useTransform(
    [sx, sy] as unknown as MotionValue<number>[],
    ([x, y]: number[]) =>
      `radial-gradient(280px circle at ${x}px ${y}px, rgba(52, 211, 153, 0.14), transparent 60%)`
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
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        delay: index * 0.08,
        duration: 0.6,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      style={{
        transformStyle: "preserve-3d",
        perspective: 1000,
        rotateX: rxSpring,
        rotateY: rySpring,
      }}
      className="group/card relative rounded-2xl [transform-style:preserve-3d]"
    >
      {/* Animated rotating gradient border — visible on hover */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-40 group-hover/card:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "conic-gradient(from var(--angle, 0deg), rgba(52,211,153,0.55), rgba(20,184,166,0.04) 40%, rgba(52,211,153,0.55) 80%, rgba(20,184,166,0.04))",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
          animation: "spin-border 9s linear infinite",
        }}
      />

      {/* Card body */}
      <div className="relative rounded-2xl bg-[#0B0F17]/95 backdrop-blur-xl p-5 sm:p-6 overflow-hidden h-full flex flex-col">
        {/* Hover spotlight */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: cardSpotlight }}
        />

        {/* HUD corner ticks */}
        <span className="pointer-events-none absolute top-2 left-2 h-2 w-2 border-l border-t border-emerald-400/40" />
        <span className="pointer-events-none absolute bottom-2 right-2 h-2 w-2 border-r border-b border-emerald-400/40" />

        {/* Top row: number + icon */}
        <div className="relative flex items-start justify-between mb-5">
          <span
            className="text-[10px] tracking-[0.35em] uppercase font-mono font-bold text-emerald-300/80"
            style={{ transform: "translateZ(15px)" }}
          >
            / {num}
          </span>
          <div
            className="shrink-0 h-11 w-11 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] flex items-center justify-center group-hover/card:border-emerald-400/50 group-hover/card:bg-emerald-400/[0.1] group-hover/card:shadow-[0_0_22px_rgba(52,211,153,0.25)] transition-all duration-500"
            style={{ transform: "translateZ(30px)" }}
          >
            <Icon icon={icon} className="text-[22px] text-emerald-300" />
          </div>
        </div>

        {/* Title */}
        <h3
          className="relative text-[17px] sm:text-[18px] font-extrabold text-white leading-snug tracking-tight"
          style={{ transform: "translateZ(20px)" }}
        >
          {title}
        </h3>

        {/* Animated underline */}
        <div className="relative mt-3 mb-3 h-px w-10 overflow-hidden bg-emerald-400/20">
          <motion.div
            className="absolute inset-y-0 w-full bg-gradient-to-r from-emerald-400/0 via-emerald-400 to-emerald-400/0"
            animate={{ x: ["-100%", "200%"] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 2 + (index % 4) * 0.4,
            }}
          />
        </div>

        {/* Desc */}
        <p
          className="relative text-white/65 text-[13px] sm:text-[13.5px] leading-relaxed"
          style={{ transform: "translateZ(10px)" }}
        >
          {desc}
        </p>
      </div>
    </motion.div>
  );
};

/* ====================== MAIN ====================== */
const ExecutiveSummary: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const beamY = useTransform(scrollYProgress, [0, 1], ["-10%", "110%"]);

  return (
    <section
      ref={sectionRef}
      id="executive-summary"
      className="relative w-full pt-4 sm:pt-6 md:pt-8 pb-6 sm:pb-8 md:pb-10 overflow-hidden bg-[#070A12]"
    >
      {/* Layered background: mesh + aurora + spotlight */}
      <MeshGrid />
      <MouseSpotlight containerRef={sectionRef} />

      {/* Scroll-bound vertical beam (web3 accent) */}
      <motion.div
        style={{ top: beamY }}
        className="hidden lg:block absolute left-1/2 -translate-x-1/2 w-[2px] h-32 bg-gradient-to-b from-transparent via-emerald-400/60 to-transparent blur-[2px] z-[1]"
      />

      {/* Local keyframes for spinning border */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin-border {
          to { --angle: 360deg; }
        }
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
      `,
        }}
      />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 max-w-screen-xl">
        {/* ───── PILL + HEADLINE ───── */}
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] backdrop-blur-md"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.25em] uppercase text-emerald-300">
              Tentang Solusindo Aset
            </span>
          </motion.div>

          <h2 className="mt-6 text-[2rem] sm:text-5xl lg:text-[3.5rem] font-extrabold text-white leading-[1.05] tracking-tight">
            <WordReveal text="Properti adalah aset terbesar Anda." />
            <br />
            <WordReveal
              text="Jangan biarkan menjadi"
              delayBase={0.25}
              className="text-white"
            />{" "}
            <span className="relative inline-block">
              <motion.span
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ delay: 0.55, duration: 0.7 }}
                className="inline-block bg-gradient-to-r from-red-300 via-red-400 to-orange-300 bg-clip-text text-transparent"
              >
                risiko terbesar
              </motion.span>
              <motion.span
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.95, duration: 0.7, ease: "easeOut" }}
                className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-red-400/80 via-red-400/40 to-transparent rounded-full origin-left"
              />
            </span>
            .
          </h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="mt-6 text-white/70 text-[15px] sm:text-lg leading-relaxed max-w-2xl mx-auto"
          >
            Solusindo Aset adalah agensi properti yang berdiri{" "}
            <span className="text-white font-semibold">di pihak Anda</span> —
            memastikan setiap properti yang Anda beli, sewa, ajukan KPR, atau menangkan
            di lelang adalah properti yang{" "}
            <span className="text-emerald-300 font-semibold">
              aman dan sah secara hukum
            </span>
            .
          </motion.p>
        </div>

        {/* ───── EMPATI: FEAR PILLS ───── */}
        <div className="mt-8 sm:mt-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] tracking-[0.3em] uppercase font-bold text-white/40">
              <span className="h-px w-8 bg-white/15" />
              Kami paham yang Anda khawatirkan
              <span className="h-px w-8 bg-white/15" />
            </div>
          </motion.div>

          <div className="mt-4">
            <FearReel />
          </div>
        </div>

        {/* ───── TRANSISI ───── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-12 sm:mt-16 max-w-3xl mx-auto text-center"
        >
          {/* Glowing vertical connector */}
          <div className="relative mx-auto h-14 w-px">
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ transformOrigin: "top" }}
              className="absolute inset-0 bg-gradient-to-b from-emerald-400/0 via-emerald-400/40 to-emerald-400/80"
            />
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]"
              animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-4 inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.06] backdrop-blur-md"
          >
            <Icon
              icon="solar:shield-check-bold"
              className="text-emerald-300 text-base"
            />
            <span className="text-[11px] sm:text-xs font-bold tracking-[0.22em] uppercase text-emerald-300">
              Di sinilah kami berdiri untuk Anda
            </span>
          </motion.div>

          <h3 className="mt-6 text-2xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
            <WordReveal text="Empat janji yang kami" />{" "}
            <motion.span
              initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                delay: 0.45,
                duration: 0.7,
                ease: [0.21, 0.47, 0.32, 0.98],
              }}
              className="inline-block bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent"
            >
              benar-benar pegang
            </motion.span>
            <span className="text-white">.</span>
          </h3>
          <p className="mt-4 text-white/55 text-[13px] sm:text-sm max-w-xl mx-auto">
            Tidak lebih, tidak kurang. Hanya hal yang bisa kami pastikan dari awal
            sampai serah terima.
          </p>
        </motion.div>

        {/* ───── EMPAT JANJI ───── */}
        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {promises.map((p, i) => (
            <PromiseCard
              key={p.num}
              num={p.num}
              icon={p.icon}
              title={p.title}
              desc={p.desc}
              index={i}
            />
          ))}
        </div>

        {/* ───── CLOSING ───── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-14 sm:mt-16 max-w-3xl mx-auto text-center"
        >
          <p className="text-white/75 text-base sm:text-xl leading-relaxed font-light italic">
            &ldquo;Anda tidak perlu menjadi ahli hukum untuk membeli properti.{" "}
            <span className="text-white font-semibold not-italic">
              Itu tugas kami.
            </span>
            &rdquo;
          </p>
          <a
            href="#contact"
            className="mt-7 inline-flex items-center gap-2 text-emerald-300 text-sm font-bold tracking-wide hover:gap-3 transition-all group"
          >
            Konsultasi tanpa biaya
            <Icon
              icon="solar:arrow-right-up-bold"
              className="text-lg group-hover:rotate-45 transition-transform duration-500"
            />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ExecutiveSummary;
